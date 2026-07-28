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
  os: z.string().max(40).optional(),
  deviceType: z.enum(["desktop", "mobile", "pwa"]).optional(),
  isPwa: z.boolean().optional(),
});

export const saveDeviceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Keep a user-chosen name if the device was renamed before.
    const { data: existing } = await context.supabase
      .from("device_subscriptions")
      .select("id, device_name")
      .eq("endpoint", data.endpoint)
      .maybeSingle();

    const { error } = await context.supabase.from("device_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        device_name: existing?.device_name ?? data.deviceName ?? null,
        platform: data.platform ?? null,
        browser: data.browser ?? null,
        os: data.os ?? null,
        device_type: data.deviceType ?? "desktop",
        is_pwa: data.isPwa ?? false,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Não foi possível registrar o dispositivo");
    return { ok: true, isNew: !existing };
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

/** Sends a push to every device of the signed-in user and records it in the history. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("device_subscriptions")
      .select("id, endpoint, p256dh, auth, device_name")
      .eq("user_id", context.userId);

    if (!subs?.length) return { sent: 0, total: 0, failed: 0 };

    const { sendPush } = await import("@/lib/webpush.server");
    const title = "Teste de Notificação";
    const body = "Se você recebeu esta mensagem, suas notificações Push estão funcionando corretamente.";
    const reached: string[] = [];
    let failed = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          const ok = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, url: "/configuracoes", tag: `orbit-test-${Date.now()}` },
          );
          if (ok) reached.push(sub.device_name ?? "Dispositivo");
          else {
            failed++;
            await context.supabase.from("device_subscriptions").delete().eq("id", sub.id);
          }
        } catch {
          failed++;
        }
      }),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_log").insert({
      user_id: context.userId,
      kind: "test",
      title,
      body,
      device_names: reached,
      delivered: reached.length,
      failed,
    });

    return { sent: reached.length, total: subs.length, failed };
  });

export type DiagnosticsResult = {
  vapid: { ok: boolean; detail: string };
  database: { ok: boolean; detail: string };
  endpoint: { ok: boolean; detail: string };
  cron: { ok: boolean; detail: string; lastRun: string | null };
  devices: { ok: boolean; detail: string; count: number };
  lastSent: string | null;
};

/** Server-side health checks for the diagnostics panel. */
export const runPushDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticsResult> => {
    const pub = process.env.VAPID_PUBLIC_KEY ?? "";
    const priv = process.env.VAPID_PRIVATE_KEY ?? "";
    const subject = process.env.VAPID_SUBJECT ?? "";
    const vapidOk = pub.length > 80 && priv.length > 20 && subject.startsWith("mailto:");

    const { count, error: dbError } = await context.supabase
      .from("device_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    let cron = { ok: false, detail: "Não foi possível verificar a rotina automática", lastRun: null as string | null };
    try {
      const { data } = await context.supabase.rpc("push_cron_status");
      const info = data as { active?: boolean; schedule?: string; last_run?: string; last_status?: string } | null;
      if (info?.active) {
        cron = {
          ok: info.last_status !== "failed",
          detail:
            info.last_status === "failed"
              ? "A última execução da rotina falhou"
              : `Ativa (${info.schedule ?? "a cada minuto"})`,
          lastRun: info.last_run ?? null,
        };
      } else {
        cron = { ok: false, detail: "Rotina automática de lembretes inativa", lastRun: null };
      }
    } catch {
      /* keep default */
    }

    const { data: last } = await context.supabase
      .from("push_log")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      vapid: {
        ok: vapidOk,
        detail: vapidOk
          ? "Chaves VAPID configuradas"
          : !pub || !priv
            ? "Chaves VAPID ausentes no servidor"
            : "Chaves VAPID inválidas",
      },
      database: {
        ok: !dbError,
        detail: dbError ? "Falha ao consultar o banco de dados" : "Banco de dados respondendo",
      },
      endpoint: {
        ok: Boolean(process.env.SUPABASE_URL),
        detail: process.env.SUPABASE_URL ? "Serviço de envio operante" : "Configuração do backend ausente",
      },
      cron,
      devices: {
        ok: (count ?? 0) > 0,
        count: count ?? 0,
        detail: count ? `${count} dispositivo(s) registrado(s)` : "Nenhum dispositivo registrado",
      },
      lastSent: last?.created_at ?? null,
    };
  });
