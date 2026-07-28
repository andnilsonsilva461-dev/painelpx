import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NotificationsBlocked } from "@/components/NotificationsBlocked";
import { DeviceCard } from "@/components/DeviceCard";
import { useDevices, usePushLog, useSettings, useUpdateSettings } from "@/lib/devices";
import {
  currentEndpoint,
  enablePush,
  isStandalone,
  localDiagnostics,
  useDeviceSync,
  usePushPermission,
} from "@/lib/push";
import { runPushDiagnostics, sendTestPush } from "@/lib/push.functions";
import { REMINDER_OFFSETS } from "@/lib/domain";
import { fmtTime, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Orbit" },
      {
        name: "description",
        content:
          "Verifique o status das notificações Push, teste o envio, acompanhe o diagnóstico e gerencie os dispositivos conectados.",
      },
      { property: "og:title", content: "Notificações — Orbit" },
      { property: "og:description", content: "Diagnóstico e teste das notificações Push do Orbit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  useDeviceSync();
  const qc = useQueryClient();
  const { permission, setPermission } = usePushPermission();
  const { data: devices } = useDevices();
  const { data: log } = usePushLog(8);
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  const [testing, setTesting] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [local, setLocal] = useState<Awaited<ReturnType<typeof localDiagnostics>> | null>(null);

  const remote = useQuery({
    queryKey: ["push-diagnostics"],
    queryFn: () => runPushDiagnostics({ data: undefined as never }),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    localDiagnostics().then(setLocal).catch(() => undefined);
    currentEndpoint().then(setEndpoint).catch(() => undefined);
  }, [permission, devices?.length]);

  const offsets = settings?.default_reminder_offsets ?? [];
  const active =
    permission === "granted" && Boolean(local?.serviceWorker) && Boolean(local?.subscription);
  const lastSync = devices?.[0]?.last_seen_at ?? null;
  const lastSent = remote.data?.lastSent ?? log?.[0]?.created_at ?? null;

  async function activate() {
    const result = await enablePush();
    if (result === "granted") {
      setPermission("granted");
      qc.invalidateQueries({ queryKey: ["devices"] });
      remote.refetch();
      localDiagnostics().then(setLocal);
      toast.success("Notificações ativadas neste dispositivo");
    } else if (result === "denied") {
      setPermission("denied");
      toast.error("Permissão negada pelo navegador");
    } else {
      toast.error("Este navegador não suporta notificações Push");
    }
  }

  async function test() {
    setTesting(true);
    try {
      const { sent, total, failed } = await sendTestPush({ data: undefined as never });
      if (sent) {
        toast.success(`Notificação enviada para ${sent} de ${total} dispositivo(s)`);
      } else if (failed) {
        toast.error("Falha ao entregar. Reative as notificações nos aparelhos.");
      } else {
        toast.error("Nenhum dispositivo registrado ainda");
      }
      qc.invalidateQueries({ queryKey: ["push-log"] });
      remote.refetch();
    } catch {
      toast.error("Não foi possível enviar a notificação de teste");
    } finally {
      setTesting(false);
    }
  }

  function toggleOffset(value: number) {
    const next = offsets.includes(value)
      ? offsets.filter((o) => o !== value)
      : [...offsets, value].sort((a, b) => b - a);
    update.mutate({ default_reminder_offsets: next });
  }

  const d = remote.data;

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Configurações</p>
        <h1 className="mt-1 text-2xl font-medium">Notificações</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Confirme que cada aparelho está registrado e apto a receber os lembretes das suas reuniões.
        </p>
      </motion.header>

      {permission === "denied" && <NotificationsBlocked className="mt-6" />}

      {/* ---------- status ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="panel relative mt-6 overflow-hidden p-6"
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-24 -top-24 size-56 rounded-full blur-3xl transition-opacity duration-700",
            active
              ? "bg-[color:var(--color-success)]/20 opacity-100"
              : "bg-[color:var(--color-danger)]/15 opacity-100",
          )}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "grid size-12 place-items-center rounded-xl border",
                active
                  ? "border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/10"
                  : "border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/10",
              )}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={active ? "on" : "off"}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {active ? <BellRing className="size-5" /> : <Bell className="size-5" />}
                </motion.span>
              </AnimatePresence>
            </span>
            <div>
              <p className="flex items-center gap-2 text-lg font-medium">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    active
                      ? "animate-pulse bg-[color:var(--color-success)]"
                      : "bg-[color:var(--color-danger)]",
                  )}
                />
                {active ? "Notificações ativadas" : "Notificações desativadas"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {active
                  ? `${devices?.length ?? 0} dispositivo(s) recebendo lembretes`
                  : "Ative para receber os lembretes mesmo com o navegador fechado"}
              </p>
            </div>
          </div>

          {!active && permission !== "unsupported" && (
            <Button onClick={activate} className="h-9">
              Ativar notificações
            </Button>
          )}
        </div>

        <dl className="relative mt-6 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatusItem
            label="Permissão do navegador"
            ok={permission === "granted"}
            value={
              permission === "granted"
                ? "Concedida"
                : permission === "denied"
                  ? "Permissão negada"
                  : permission === "unsupported"
                    ? "Não suportado neste navegador"
                    : "Ainda não solicitada"
            }
          />
          <StatusItem
            label="Service Worker"
            ok={Boolean(local?.serviceWorker)}
            value={local?.serviceWorker ? "Registrado" : "Service Worker não registrado"}
          />
          <StatusItem
            label="Push Subscription"
            ok={Boolean(local?.subscription)}
            value={local?.subscription ? "Ativa neste aparelho" : "Push Subscription inexistente"}
          />
          <StatusItem
            label="Última sincronização"
            ok={Boolean(lastSync)}
            value={lastSync ? `${relativeDayLabel(lastSync)} às ${fmtTime(lastSync)}` : "Nunca sincronizado"}
            neutral
          />
          <StatusItem
            label="Última notificação enviada"
            ok={Boolean(lastSent)}
            value={lastSent ? `${relativeDayLabel(lastSent)} às ${fmtTime(lastSent)}` : "Nenhum envio registrado"}
            neutral
          />
          <StatusItem
            label="Última recebida neste aparelho"
            ok={Boolean(endpoint && log?.length)}
            value={
              endpoint && log?.length
                ? `${relativeDayLabel(log[0].created_at)} às ${fmtTime(log[0].created_at)}`
                : "Nenhuma recebida ainda"
            }
            neutral
          />
        </dl>
      </motion.section>

      {/* ---------- test ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="panel mt-5 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">Testar entrega</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Envia uma notificação real para todos os dispositivos registrados.
            </p>
          </div>
          <Button onClick={test} disabled={testing} className="h-11 gap-2 px-6 text-[13px]">
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {testing ? "Enviando…" : "Enviar Notificação de Teste"}
          </Button>
        </div>
      </motion.section>

      {/* ---------- diagnostics ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="panel mt-5 overflow-hidden"
      >
        <div className="hairline flex items-center justify-between px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-medium">Diagnóstico</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Verificação completa da cadeia de entrega</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              remote.refetch();
              localDiagnostics().then(setLocal);
            }}
            disabled={remote.isFetching}
          >
            {remote.isFetching ? "Verificando…" : "Reexecutar"}
          </Button>
        </div>
        <div className="divide-y divide-border">
          <Diag ok={Boolean(local?.serviceWorker)} label="Service Worker registrado" detail={local?.serviceWorker ? "/sw.js ativo" : "Service Worker não registrado neste navegador"} />
          <Diag ok={Boolean(local?.subscription)} label="Push Subscription válida" detail={local?.subscription ? "Assinatura presente neste aparelho" : "Push Subscription inexistente"} />
          <Diag ok={d?.vapid.ok} label="VAPID configurado" detail={d?.vapid.detail} loading={remote.isLoading} />
          <Diag ok={d?.endpoint.ok} label="Serviço de envio funcionando" detail={d?.endpoint.detail} loading={remote.isLoading} />
          <Diag
            ok={d?.cron.ok}
            label="Rotina automática de lembretes"
            detail={
              d?.cron.lastRun
                ? `${d.cron.detail} · última execução ${relativeDayLabel(d.cron.lastRun)} às ${fmtTime(d.cron.lastRun)}`
                : d?.cron.detail
            }
            loading={remote.isLoading}
          />
          <Diag ok={d?.database.ok} label="Banco de dados conectado" detail={d?.database.detail} loading={remote.isLoading} />
          <Diag ok={d?.devices.ok} label="Dispositivos registrados" detail={d?.devices.detail} loading={remote.isLoading} />
        </div>
      </motion.section>

      {/* ---------- reminders ---------- */}
      <section className="panel mt-5 overflow-hidden">
        <div className="hairline px-5 py-3.5">
          <h2 className="text-[13px] font-medium">Lembretes padrão</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Aplicados às novas reuniões. Cada reunião pode ser ajustada individualmente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 p-5">
          {REMINDER_OFFSETS.map((r) => {
            const on = offsets.includes(r.value);
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleOffset(r.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-all duration-200 active:scale-[0.97]",
                  on ? "border-foreground/25 bg-elevated" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                {on && <Check className="size-3" />}
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="hairline-t flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div>
            <p className="text-[13px] font-medium">Resumo diário</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Uma notificação pela manhã com o total de reuniões do dia.
            </p>
          </div>
          <Switch
            checked={settings?.daily_digest ?? false}
            onCheckedChange={(v) => update.mutate({ daily_digest: v })}
          />
        </div>
        {settings?.daily_digest && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-5 py-4">
            <span className="mr-1 text-[11px] text-muted-foreground">Horário:</span>
            {[6, 7, 8, 9, 10].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => update.mutate({ daily_digest_hour: h })}
                className={cn(
                  "tabular rounded-md border px-2.5 py-1 text-[12px] transition-colors duration-200",
                  settings.daily_digest_hour === h
                    ? "border-foreground/25 bg-elevated"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                {String(h).padStart(2, "0")}:00
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---------- devices ---------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[13px] font-medium">Dispositivos Registrados</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {devices?.length ?? 0} aparelho(s) vinculados à sua conta — cada login com notificações permitidas
              aparece aqui automaticamente
            </p>
          </div>
          <Link
            to="/dispositivos"
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Gerenciar <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid gap-3">
          {!devices?.length && (
            <p className="panel px-5 py-10 text-center text-[11px] text-muted-foreground">
              Nenhum dispositivo registrado. Ative as notificações para registrar este aparelho.
            </p>
          )}
          {devices?.map((device, i) => (
            <DeviceCard key={device.id} device={device} current={device.endpoint === endpoint} index={i} />
          ))}
        </div>
      </section>


      {/* ---------- history ---------- */}
      <section className="panel mt-8 overflow-hidden">
        <div className="hairline px-5 py-3.5">
          <h2 className="text-[13px] font-medium">Histórico de envios</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Últimas notificações disparadas pela sua conta</p>
        </div>
        <div className="divide-y divide-border">
          {!log?.length && (
            <p className="px-5 py-10 text-center text-[11px] text-muted-foreground">
              Nenhuma notificação enviada ainda.
            </p>
          )}
          {log?.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="row-hover flex items-start gap-3 px-5 py-3.5"
            >
              <span className="tabular mt-0.5 w-[76px] shrink-0 text-[11px] text-muted-foreground">
                {relativeDayLabel(entry.created_at)} {fmtTime(entry.created_at)}
              </span>
              {entry.delivered ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-success)]" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-danger)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{entry.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {entry.device_names.length
                    ? `Enviada para: ${entry.device_names.join(", ")}`
                    : "Nenhum dispositivo recebeu"}
                  {entry.failed > 0 && ` · ${entry.failed} falha(s)`}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {isStandalone() && (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Você está usando o Orbit como aplicativo instalado.
        </p>
      )}
    </div>
  );
}

function StatusItem({
  label,
  value,
  ok,
  neutral,
}: {
  label: string;
  value: string;
  ok: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-elevated/50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px]">
        {!neutral &&
          (ok ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-[color:var(--color-success)]" />
          ) : (
            <XCircle className="size-3.5 shrink-0 text-[color:var(--color-danger)]" />
          ))}
        <span className={cn("truncate", !ok && !neutral && "text-[color:var(--color-danger)]")}>{value}</span>
      </p>
    </div>
  );
}

function Diag({
  ok,
  label,
  detail,
  loading,
}: {
  ok?: boolean;
  label: string;
  detail?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      {loading ? (
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-success)]" />
      ) : ok === false ? (
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-danger)]" />
      ) : (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {detail && (
          <p className={cn("mt-0.5 text-[11px] text-muted-foreground", ok === false && "text-[color:var(--color-danger)]")}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
