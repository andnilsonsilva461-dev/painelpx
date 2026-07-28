import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Laptop, Monitor, Pencil, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { removeDeviceSubscription, renameDevice } from "@/lib/push.functions";
import type { Device } from "@/lib/devices";
import { fmtDay, fmtTime, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function deviceIcon(device: Pick<Device, "platform" | "device_type">) {
  if (device.device_type === "mobile") return Smartphone;
  if (/ipad/i.test(device.platform ?? "")) return Tablet;
  if (/macos|mac/i.test(device.platform ?? "")) return Laptop;
  if (device.device_type === "pwa") return Smartphone;
  return Monitor;
}

const TYPE_LABEL: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", pwa: "PWA" };

/** A device is considered online when it checked in within the last 5 minutes. */
export function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export function DeviceCard({
  device,
  current,
  index = 0,
}: {
  device: Device;
  current: boolean;
  index?: number;
}) {
  const qc = useQueryClient();
  const Icon = deviceIcon(device);
  const online = isOnline(device.last_seen_at);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.device_name ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return setEditing(false);
    setBusy(true);
    try {
      await renameDevice({ data: { id: device.id, name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["devices"] });
      setEditing(false);
      toast.success("Nome atualizado");
    } catch {
      toast.error("Não foi possível renomear");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeDeviceSubscription({ data: { id: device.id } });
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Dispositivo removido");
    } catch {
      toast.error("Não foi possível remover");
      setBusy(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface p-4 transition-all duration-300",
        "hover:border-border-strong hover:shadow-[var(--shadow-lift)]",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-elevated">
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                maxLength={80}
                className="h-7 max-w-[220px] text-[13px]"
              />
              <Button size="icon" variant="ghost" className="size-7" onClick={save} aria-label="Salvar">
                <Check className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(false)} aria-label="Cancelar">
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-medium">{device.device_name ?? "Dispositivo"}</p>
              {current && (
                <span className="rounded border border-border bg-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  este aparelho
                </span>
              )}
            </div>
          )}

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {[device.browser, device.os ?? device.platform, TYPE_LABEL[device.device_type] ?? device.device_type]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-3">
            <Meta label="Último acesso" value={`${relativeDayLabel(device.last_seen_at)} às ${fmtTime(device.last_seen_at)}`} />
            <Meta label="Registrado em" value={fmtDay(device.created_at)} />
            <Meta
              label="Push"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[color:var(--color-success)]" />
                  Ativo
                </span>
              }
            />
          </dl>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]",
              online
                ? "border-[color:var(--color-success)]/35 bg-[color:var(--color-success)]/10"
                : "border-border bg-elevated text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                online ? "animate-pulse bg-[color:var(--color-success)]" : "bg-muted-foreground/50",
              )}
            />
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3 opacity-70 transition-opacity duration-200 group-hover:opacity-100">
        {!editing && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-[11px]" onClick={() => setEditing(true)}>
            <Pencil className="size-3" />
            Renomear
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-[color:var(--color-danger)]"
          onClick={remove}
        >
          <Trash2 className="size-3" />
          Remover
        </Button>
      </div>
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</dt>
      <dd className="mt-0.5 truncate">{value}</dd>
    </div>
  );
}
