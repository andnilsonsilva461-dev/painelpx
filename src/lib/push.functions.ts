import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key — safe to expose, it is the client half of the push keypair. */
export const getVapidKey = createServerFn({ method: "GET" }).handler(async () => ({
  key: process.env.VAPID_PUBLIC_KEY ?? "",
}));

const subSchema = z.object({
  endpoint: z.string().url().max(600),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(4).max(100),
  userAgent: z.string().max(300).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Não foi possível registrar o dispositivo");
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: z.string().url().max(600) }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", context.userId);

    if (!subs?.length) return { sent: 0 };

    const { sendPush } = await import("@/lib/webpush.server");
    let sent = 0;
    for (const sub of subs) {
      try {
        const ok = await sendPush(sub, {
          title: "🔔 Notificações ativadas",
          body: "Você receberá lembretes das suas reuniões neste dispositivo.",
          url: "/dashboard",
          tag: "orbit-test",
        });
        if (ok) sent++;
      } catch {
        /* ignore individual endpoint failures */
      }
    }
    return { sent };
  });
