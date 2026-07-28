import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/webpush.server";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; device_name: string | null };

/**
 * Reminder sweep, called every minute by pg_cron.
 * Fully server-side: reminders fire even with every device closed.
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
        const subsCache = new Map<string, Sub[]>();

        async function devicesFor(userId: string) {
          const cached = subsCache.get(userId);
          if (cached) return cached;
          const { data } = await admin
            .from("device_subscriptions")
            .select("id, endpoint, p256dh, auth, device_name")
            .eq("user_id", userId);
          const list = (data ?? []) as Sub[];
          subsCache.set(userId, list);
          return list;
        }

        async function deliver(
          userId: string,
          payload: { title: string; body: string; url: string; tag: string; requireInteraction?: boolean },
          log: { kind: string; meetingId?: string | null },
        ) {
          const subs = await devicesFor(userId);
          const reached: string[] = [];
          let failed = 0;

          await Promise.all(
            subs.map(async (sub) => {
              try {
                const ok = await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
                if (ok) reached.push(sub.device_name ?? "Dispositivo");
                else {
                  failed++;
                  await admin.from("device_subscriptions").delete().eq("id", sub.id);
                }
              } catch {
                failed++;
              }
            }),
          );

          if (subs.length) {
            await admin.from("push_log").insert({
              user_id: userId,
              meeting_id: log.meetingId ?? null,
              kind: log.kind,
              title: payload.title,
              body: payload.body,
              device_names: reached,
              delivered: reached.length,
              failed,
            });
          }

          return reached.length;
        }

        let delivered = 0;
        let due = 0;

        // ---- 1. per-meeting reminders -------------------------------------
        const { data: meetings, error } = await admin
          .from("meetings")
          .select("id, user_id, title, starts_at, reminder_offsets, status, clients(name)")
          .gte("starts_at", new Date(now.getTime() - 5 * 60 * 1000).toISOString())
          .lte("starts_at", new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString())
          .in("status", ["agendada", "confirmada", "reagendada"]);

        if (error) return json({ error: "query_failed" }, 500);

        for (const m of meetings ?? []) {
          const start = new Date(m.starts_at).getTime();
          const offsets: number[] = m.reminder_offsets ?? [];
          const name = (m as unknown as { clients?: { name?: string } | null }).clients?.name ?? m.title ?? "Cliente";

          for (const off of offsets) {
            const diff = now.getTime() - (start - off * 60 * 1000);
            if (diff < 0 || diff >= 2 * 60 * 1000) continue; // 2-minute firing window
            due++;

            const { error: dup } = await admin.from("reminder_log").insert({
              user_id: m.user_id,
              meeting_id: m.id,
              kind: "meeting",
              offset_minutes: off,
            });
            if (dup) continue; // already sent

            const body = offsetLabel(off, name);

            await admin.from("notifications").insert({
              user_id: m.user_id,
              meeting_id: m.id,
              title: "Lembrete de reunião",
              message: body,
            });

            delivered += await deliver(m.user_id, {
              title: "🔔 Reunião",
              body,
              url: `/agenda?m=${m.id}`,
              tag: `meeting-${m.id}-${off}`,
              requireInteraction: off <= 15,
            },
            { kind: "meeting", meetingId: m.id });
          }
        }

        // ---- 2. daily digest ----------------------------------------------
        const { data: settings } = await admin
          .from("user_settings")
          .select("user_id, daily_digest, daily_digest_hour, timezone")
          .eq("daily_digest", true);

        for (const s of settings ?? []) {
          const local = zoned(now, s.timezone);
          if (local.hour !== s.daily_digest_hour || local.minute >= 2) continue;

          const kind = `digest:${local.date}`;
          const { error: dup } = await admin.from("reminder_log").insert({
            user_id: s.user_id,
            meeting_id: null,
            kind,
          });
          if (dup) continue;

          const dayStart = new Date(now);
          dayStart.setHours(0, 0, 0, 0);
          const { count } = await admin
            .from("meetings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", s.user_id)
            .gte("starts_at", dayStart.toISOString())
            .lt("starts_at", new Date(dayStart.getTime() + 86400000).toISOString())
            .in("status", ["agendada", "confirmada", "reagendada"]);

          if (!count) continue;
          due++;

          const body =
            count === 1 ? "Você possui 1 reunião hoje." : `Você possui ${count} reuniões hoje.`;

          await admin
            .from("notifications")
            .insert({ user_id: s.user_id, title: "Resumo do dia", message: body });

          delivered += await deliver(s.user_id, {
            title: "📅 Resumo do dia",
            body,
            url: "/agenda",
            tag: kind,
          },
          { kind: "digest" });
        }

        return json({ ok: true, checked: meetings?.length ?? 0, due, delivered });
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

/** Hour/minute/date of `at` inside an IANA timezone. */
function zoned(at: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    return {
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      date: `${get("year")}-${get("month")}-${get("day")}`,
    };
  } catch {
    return { hour: at.getUTCHours(), minute: at.getUTCMinutes(), date: at.toISOString().slice(0, 10) };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
