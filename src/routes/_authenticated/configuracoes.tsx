import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Laptop,
  Monitor,
  Send,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NotificationsBlocked } from "@/components/NotificationsBlocked";
import { useDevices, useSettings, useUpdateSettings } from "@/lib/devices";
import { enablePush, describeDevice, isStandalone, usePushPermission, useDeviceSync } from "@/lib/push";
import { removeDeviceSubscription, sendTestPush } from "@/lib/push.functions";
import { REMINDER_OFFSETS } from "@/lib/domain";
import { relativeDayLabel, fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Orbit" },
      {
        name: "description",
        content: "Gerencie lembretes, dispositivos conectados e teste as notificações push do Orbit.",
      },
      { property: "og:title", content: "Notificações — Orbit" },
      { property: "og:description", content: "Configure os lembretes das suas reuniões em todos os aparelhos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  useDeviceSync();
  const qc = useQueryClient();
  const { permission, setPermission } = usePushPermission();
  const { data: devices, isLoading } = useDevices();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [testing, setTesting] = useState(false);

  const thisEndpointName = typeof navigator !== "undefined" ? describeDevice().deviceName : "";
  const offsets = settings?.default_reminder_offsets ?? [];

  async function activate() {
    const result = await enablePush();
    if (result === "granted") {
      setPermission("granted");
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Notificações ativadas neste dispositivo");
    } else if (result === "denied") {
      setPermission("denied");
    } else {
      toast.error("Este navegador não suporta notificações push");
    }
  }

  async function test() {
    setTesting(true);
    try {
      const { sent, total } = await sendTestPush({ data: undefined as never });
      if (sent) toast.success(`Notificação enviada para ${sent} de ${total} dispositivo(s)`);
      else toast.error("Nenhum dispositivo recebeu. Ative as notificações primeiro.");
    } catch {
      toast.error("Falha ao enviar a notificação de teste");
    } finally {
      setTesting(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeDeviceSubscription({ data: { id } });
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Dispositivo removido");
    } catch {
      toast.error("Não foi possível remover");
    }
  }

  function toggleOffset(value: number) {
    const next = offsets.includes(value) ? offsets.filter((o) => o !== value) : [...offsets, value].sort((a, b) => b - a);
    update.mutate({ default_reminder_offsets: next });
  }

  const lastSync = devices?.[0]?.last_seen_at;

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-medium">Notificações</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Lembretes push gratuitos, entregues em todos os seus aparelhos.
        </p>
      </motion.div>

      {permission === "denied" && <NotificationsBlocked className="mt-6" />}

      {/* status */}
      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-9 place-items-center rounded-md border",
                permission === "granted"
                  ? "border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/10"
                  : "border-border bg-elevated",
              )}
            >
              {permission === "granted" ? (
                <BellRing className="size-4" />
              ) : permission === "denied" ? (
                <BellOff className="size-4" />
              ) : (
                <Bell className="size-4" />
              )}
            </span>
            <div>
              <p className="text-[13px] font-medium">
                {permission === "granted"
                  ? "Notificações ativas"
                  : permission === "denied"
                    ? "Notificações bloqueadas"
                    : permission === "unsupported"
                      ? "Não suportado neste navegador"
                      : "Notificações desativadas"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {lastSync
                  ? `Última sincronização: ${relativeDayLabel(lastSync)} às ${fmtTime(lastSync)}`
                  : "Nenhum dispositivo sincronizado ainda"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permission !== "granted" && permission !== "unsupported" && (
              <Button size="sm" className="h-8 text-xs" onClick={activate}>
                Ativar agora
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={test}
              disabled={testing || !devices?.length}
            >
              <Send className="size-3" />
              {testing ? "Enviando…" : "Testar notificação"}
            </Button>
          </div>
        </div>
      </section>

      {/* default reminders */}
      <section className="panel mt-6 overflow-hidden">
        <div className="hairline px-5 py-3.5">
          <h2 className="text-[13px] font-medium">Lembretes padrão</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Aplicados a novas reuniões. Cada reunião pode ser ajustada individualmente.
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
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-all duration-200",
                  on ? "border-foreground/25 bg-elevated" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                {on && <Check className="size-3" />}
                {r.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* digest */}
      <section className="panel mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
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
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
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

      {/* devices */}
      <section className="panel mt-6 overflow-hidden">
        <div className="hairline flex items-center justify-between px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-medium">Meus dispositivos</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {devices?.length ?? 0} aparelho(s) recebendo lembretes
            </p>
          </div>
          <Link to="/dispositivos" className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            Ver tudo
          </Link>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <p className="px-5 py-8 text-center text-[11px] text-muted-foreground">Carregando…</p>}
          {!isLoading && !devices?.length && (
            <p className="px-5 py-8 text-center text-[11px] text-muted-foreground">
              Nenhum dispositivo conectado. Ative as notificações para registrar este aparelho.
            </p>
          )}
          {devices?.slice(0, 4).map((d) => (
            <DeviceRow
              key={d.id}
              device={d}
              current={d.device_name === thisEndpointName}
              onRemove={() => remove(d.id)}
            />
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

export function deviceIcon(platform: string | null) {
  if (!platform) return Monitor;
  if (/android|iphone/i.test(platform)) return Smartphone;
  if (/ipad/i.test(platform)) return Tablet;
  if (/macos|mac/i.test(platform)) return Laptop;
  return Monitor;
}

function DeviceRow({
  device,
  current,
  onRemove,
}: {
  device: { id: string; device_name: string | null; platform: string | null; browser: string | null; last_seen_at: string };
  current?: boolean;
  onRemove: () => void;
}) {
  const Icon = deviceIcon(device.platform);
  return (
    <div className="row-hover flex items-center gap-3 px-5 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">
          {device.device_name ?? "Dispositivo"}
          {current && <span className="ml-2 text-[10px] text-muted-foreground">(este)</span>}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {device.browser ?? "Navegador"} · {relativeDayLabel(device.last_seen_at)} às {fmtTime(device.last_seen_at)}
        </p>
      </div>
      <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--color-success)]" />
      <button
        onClick={onRemove}
        aria-label="Remover dispositivo"
        className="text-muted-foreground transition-colors hover:text-[color:var(--color-danger)]"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
