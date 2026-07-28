import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/webpush.server";

/**
 * Reminder sweep. Called every minute by a scheduled job (pg_cron -> pg_net).
 * Runs entirely server-side: reminders fire whether or not the app is open.
 */
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return json({ error: "Unauthorized" }, 401);
        }

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const now = new Date();
        const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        const { data: meetings, error } = await admin
          .from("meetings")
          .select("id, user_id, title, starts_at, reminder_offsets, status, clients(name)")
          .gte("starts_at", new Date(now.getTime() - 5 * 60 * 1000).toISOString())
          .lte("starts_at", horizon.toISOString())
          .in("status", ["agendada", "confirmada", "reagendada"]);

        if (error) return json({ error: "query_failed" }, 500);

        const due: { userId: string; meetingId: string; offset: number; name: string; startsAt: string }[] = [];

        for (const m of meetings ?? []) {
          const start = new Date(m.starts_at).getTime();
          const offsets: number[] = m.reminder_offsets ?? [];
          const name =
            (m as unknown as { clients?: { name?: string } | null }).clients?.name ?? m.title ?? "Cliente";

          for (const off of offsets) {
            const fireAt = start - off * 60 * 1000;
            const diff = now.getTime() - fireAt;
            // fire inside a 2-minute window after the target moment
            if (diff >= 0 && diff < 2 * 60 * 1000) {
              due.push({ userId: m.user_id, meetingId: m.id, offset: off, name, startsAt: m.starts_at });
            }
          }
        }

        let delivered = 0;

        for (const item of due) {
          const { error: logError } = await admin.from("reminder_log").insert({
            user_id: item.userId,
            meeting_id: item.meetingId,
            kind: "meeting",
            offset_minutes: item.offset,
          });
          if (logError) continue; // already sent (unique index)

          const body = offsetLabel(item.offset, item.name);

          await admin.from("notifications").insert({
            user_id: item.userId,
            meeting_id: item.meetingId,
            title: "Lembrete de reunião",
            message: body,
          });

          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", item.userId);

          for (const sub of subs ?? []) {
            try {
              const ok = await sendPush(sub, {
                title: "🔔 Reunião",
                body,
                url: `/agenda?m=${item.meetingId}`,
                tag: `meeting-${item.meetingId}-${item.offset}`,
                requireInteraction: item.offset <= 15,
              });
              if (ok) delivered++;
              else await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            } catch {
              /* keep going */
            }
          }
        }

        return json({ ok: true, checked: meetings?.length ?? 0, due: due.length, delivered });
      },
    },
  },
});

function offsetLabel(offset: number, name: string) {
  if (offset === 0) return `Sua reunião com ${name} começa agora.`;
  if (offset < 60) return `Sua reunião com ${name} começa em ${offset} minutos.`;
  if (offset < 1440) {
    const h = Math.round(offset / 60);
    return `Sua reunião com ${name} começa em ${h} ${h === 1 ? "hora" : "horas"}.`;
  }
  const d = Math.round(offset / 1440);
  return `Sua reunião com ${name} é em ${d} ${d === 1 ? "dia" : "dias"}.`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
