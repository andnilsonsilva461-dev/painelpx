import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Instagram, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { MeetingDialog } from "@/components/MeetingDialog";
import { useClient, useClientMeetings, useTimeline, useUpdateClient } from "@/lib/data";
import { CLIENT_STATUS_LABEL, SOURCE_LABEL, type ClientStatus, type MeetingWithClient } from "@/lib/domain";
import { fmtDay, fmtTime, relativeDayLabel } from "@/lib/dates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/clientes/$clientId")({
  head: () => ({
    meta: [
      { title: "Ficha do cliente — Orbit" },
      { name: "description", content: "Histórico completo do lead: reuniões, remarcações e evolução do relacionamento." },
      { property: "og:title", content: "Ficha do cliente — Orbit" },
      { property: "og:description", content: "Histórico completo do lead e suas reuniões." },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { data: client } = useClient(clientId);
  const { data: meetings } = useClientMeetings(clientId);
  const { data: timeline } = useTimeline(clientId);
  const updateClient = useUpdateClient();
  const [selected, setSelected] = useState<MeetingWithClient | null>(null);
  const [creating, setCreating] = useState(false);

  if (!client) {
    return (
      <div className="mx-auto max-w-[900px] px-6 py-16 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 flex flex-wrap items-start gap-4"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-medium">{client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            {client.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" /> {client.company}
              </span>
            )}
            {client.phone && (
              <a
                href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-3.5" /> {client.phone}
              </a>
            )}
            {client.instagram && (
              <a
                href={`https://instagram.com/${client.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Instagram className="size-3.5" /> {client.instagram}
              </a>
            )}
            {client.source && <span>Origem: {SOURCE_LABEL[client.source]}</span>}
          </div>
        </div>

        <Select
          value={client.status}
          onValueChange={(v) => updateClient.mutate({ id: client.id, values: { status: v as ClientStatus } })}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CLIENT_STATUS_LABEL) as ClientStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {CLIENT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Reunião
        </Button>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="panel overflow-hidden">
          <div className="px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Reuniões</h2>
          </div>
          <div className="divide-y divide-border">
            {(meetings ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="row-hover flex w-full items-center gap-3 px-5 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{m.title || "Reunião"}</p>
                  <p className="tabular truncate text-[11px] text-muted-foreground">
                    {fmtDay(m.starts_at)} {fmtTime(m.starts_at)} · {m.duration_minutes} min
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </button>
            ))}
            {(meetings ?? []).length === 0 && (
              <p className="px-5 py-10 text-center text-xs text-muted-foreground">
                Nenhuma reunião registrada.
              </p>
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Histórico</h2>
          </div>
          <ol className="relative space-y-4 px-5 py-4">
            {(timeline ?? []).map((e) => (
              <li key={e.id} className="relative pl-4">
                <span className="absolute left-0 top-1.5 size-1.5 rounded-full bg-accent" />
                <p className="text-[12px] leading-snug">{e.description ?? e.event_type}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{relativeDayLabel(e.created_at)}</p>
              </li>
            ))}
            {(timeline ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Sem eventos ainda.</p>
            )}
          </ol>
        </section>
      </div>

      <MeetingDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} meeting={selected} />
      <MeetingDialog open={creating} onOpenChange={setCreating}  />
    </div>
  );
}
