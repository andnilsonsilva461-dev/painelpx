import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MonitorSmartphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DeviceCard, isOnline } from "@/components/DeviceCard";
import { useDevices } from "@/lib/devices";
import { currentEndpoint, registerDevice, useDeviceSync } from "@/lib/push";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dispositivos")({
  head: () => ({
    meta: [
      { title: "Meus dispositivos — Orbit" },
      {
        name: "description",
        content:
          "Veja todos os aparelhos registrados na sua conta, renomeie, remova e confirme quais recebem notificações Push.",
      },
      { property: "og:title", content: "Meus dispositivos — Orbit" },
      { property: "og:description", content: "Controle quais aparelhos recebem seus lembretes de reunião." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevicesPage,
});

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "online", label: "Online" },
  { id: "desktop", label: "Desktop" },
  { id: "mobile", label: "Mobile" },
] as const;

function DevicesPage() {
  useDeviceSync();
  const qc = useQueryClient();
  const { data: devices, isLoading } = useDevices();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    currentEndpoint().then(setEndpoint).catch(() => undefined);
  }, [devices?.length]);

  const list = useMemo(() => {
    if (!devices) return [];
    if (filter === "online") return devices.filter((d) => isOnline(d.last_seen_at));
    if (filter === "desktop") return devices.filter((d) => d.device_type === "desktop");
    if (filter === "mobile") return devices.filter((d) => d.device_type !== "desktop");
    return devices;
  }, [devices, filter]);

  async function sync() {
    setSyncing(true);
    try {
      const ok = await registerDevice();
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast[ok ? "success" : "error"](
        ok ? "Este dispositivo foi sincronizado" : "Ative as notificações neste aparelho primeiro",
      );
    } catch {
      toast.error("Não foi possível sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const onlineCount = devices?.filter((d) => isOnline(d.last_seen_at)).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Notificações
        </Link>
        <h1 className="mt-2 text-2xl font-medium">Meus dispositivos</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Cada aparelho em que você ativar as notificações é registrado automaticamente — {devices?.length ?? 0} no
          total, {onlineCount} online agora.
        </p>
      </motion.header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[12px] transition-all duration-200 active:scale-[0.97]",
                filter === f.id
                  ? "border-foreground/25 bg-elevated"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11px]" onClick={sync} disabled={syncing}>
          <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
          Sincronizar este aparelho
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {isLoading && (
          <p className="panel px-5 py-12 text-center text-[11px] text-muted-foreground">Carregando dispositivos…</p>
        )}
        {!isLoading && !list.length && (
          <div className="panel flex flex-col items-center gap-3 px-5 py-14 text-center">
            <MonitorSmartphone className="size-6 text-muted-foreground" />
            <p className="text-[13px]">Nenhum dispositivo nesta visão</p>
            <p className="max-w-[320px] text-[11px] text-muted-foreground">
              Abra o Orbit em outro aparelho e permita as notificações — ele aparecerá aqui automaticamente.
            </p>
          </div>
        )}
        {list.map((device, i) => (
          <DeviceCard key={device.id} device={device} current={device.endpoint === endpoint} index={i} />
        ))}
      </div>
    </div>
  );
}
