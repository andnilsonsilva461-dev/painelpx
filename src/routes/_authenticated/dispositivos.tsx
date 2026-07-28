import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDevices, type Device } from "@/lib/devices";
import { removeDeviceSubscription, renameDevice } from "@/lib/push.functions";
import { describeDevice, useDeviceSync } from "@/lib/push";
import { deviceIcon } from "./configuracoes";
import { relativeDayLabel, fmtTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/dispositivos")({
  head: () => ({
    meta: [
      { title: "Meus dispositivos — Orbit" },
      {
        name: "description",
        content: "Veja e gerencie todos os aparelhos que recebem lembretes de reuniões do Orbit.",
      },
      { property: "og:title", content: "Meus dispositivos — Orbit" },
      { property: "og:description", content: "Controle quais aparelhos recebem seus lembretes." },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  useDeviceSync();
  const qc = useQueryClient();
  const { data: devices, isLoading } = useDevices();
  const currentName = typeof navigator !== "undefined" ? describeDevice().deviceName : "";

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-medium">Meus dispositivos</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Cada aparelho em que você ativar as notificações aparece aqui automaticamente.
        </p>
      </motion.div>

      <div className="panel mt-6 divide-y divide-border overflow-hidden">
        {isLoading && <p className="px-5 py-10 text-center text-[11px] text-muted-foreground">Carregando…</p>}
        {!isLoading && !devices?.length && (
          <p className="px-5 py-10 text-center text-[11px] text-muted-foreground">
            Nenhum dispositivo conectado ainda.
          </p>
        )}
        {devices?.map((d) => (
          <Row key={d.id} device={d} current={d.device_name === currentName} qc={qc} />
        ))}
      </div>
    </div>
  );
}

function Row({
  device,
  current,
  qc,
}: {
  device: Device;
  current: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const Icon = deviceIcon(device.platform);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.device_name ?? "");

  async function save() {
    if (!name.trim()) return setEditing(false);
    try {
      await renameDevice({ data: { id: device.id, name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["devices"] });
      setEditing(false);
      toast.success("Nome atualizado");
    } catch {
      toast.error("Não foi possível renomear");
    }
  }

  async function remove() {
    try {
      await removeDeviceSubscription({ data: { id: device.id } });
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Dispositivo removido");
    } catch {
      toast.error("Não foi possível remover");
    }
  }

  return (
    <div className="row-hover flex items-center gap-3 px-5 py-4">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
              className="h-7 max-w-[240px] text-[13px]"
            />
            <Button size="icon" variant="ghost" className="size-7" onClick={save}>
              <Check className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <p className="truncate text-[13px]">
            {device.device_name ?? "Dispositivo"}
            {current && <span className="ml-2 text-[10px] text-muted-foreground">(este aparelho)</span>}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[device.platform, device.browser].filter(Boolean).join(" · ") || "Navegador"} · ativo{" "}
          {relativeDayLabel(device.last_seen_at).toLowerCase()} às {fmtTime(device.last_seen_at)}
        </p>
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          aria-label="Renomear"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <button
        onClick={remove}
        aria-label="Remover"
        className="text-muted-foreground transition-colors hover:text-[color:var(--color-danger)]"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
