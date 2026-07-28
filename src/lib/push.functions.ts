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
  deviceName: z.string().max(80).optional(),
  platform: z.string().max(40).optional(),
  browser: z.string().max(40).optional(),
});

export const saveDeviceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("device_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        device_name: data.deviceName ?? null,
        platform: data.platform ?? null,
        browser: data.browser ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Não foi possível registrar o dispositivo");
    return { ok: true };
  });

export const removeDeviceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("device_subscriptions").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível remover o dispositivo");
    return { ok: true };
  });

export const renameDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_subscriptions")
      .update({ device_name: data.name })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível renomear o dispositivo");
    return { ok: true };
  });

/** Sends a push to every device of the signed-in user. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("device_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", context.userId);

    if (!subs?.length) return { sent: 0, total: 0 };

    const { sendPush } = await import("@/lib/webpush.server");
    let sent = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          const ok = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            {
              title: "🔔 Notificações funcionando",
              body: "Este dispositivo receberá os lembretes das suas reuniões.",
              url: "/configuracoes",
              tag: `orbit-test-${Date.now()}`,
            },
          );
          if (ok) sent++;
          else await context.supabase.from("device_subscriptions").delete().eq("id", sub.id);
        } catch {
          /* ignore individual endpoint failures */
        }
      }),
    );

    return { sent, total: subs.length };
  });
