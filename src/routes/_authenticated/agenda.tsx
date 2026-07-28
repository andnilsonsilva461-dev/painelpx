import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { MeetingDialog } from "@/components/MeetingDialog";
import { RescheduleDialog } from "@/components/RescheduleDialog";
import { useAllMeetings, useUpdateMeeting } from "@/lib/data";
import { addDays, fmtTime, format, isSameDay, L, relativeDayLabel } from "@/lib/dates";
import type { MeetingWithClient } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Orbit" },
      { name: "description", content: "Lista cronológica das reuniões do dia com ações rápidas de confirmação e remarcação." },
      { property: "og:title", content: "Agenda — Orbit" },
      { property: "og:description", content: "Lista cronológica das reuniões do dia." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data: meetings } = useAllMeetings();
  const update = useUpdateMeeting();
  const [day, setDay] = useState(() => new Date());
  const [selected, setSelected] = useState<MeetingWithClient | null>(null);
  const [reschedule, setReschedule] = useState<MeetingWithClient | null>(null);
  const [creating, setCreating] = useState(false);

  const items = useMemo(
    () =>
      (meetings ?? [])
        .filter((m) => isSameDay(new Date(m.starts_at), day))
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [meetings, day],
  );

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-eyebrow">{relativeDayLabel(day)}</p>
          <h1 className="mt-1.5 text-2xl font-medium capitalize">{format(day, "EEEE, d 'de' MMMM", L)}</h1>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setDay(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" className="ml-2 h-7" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> Nova
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-1.5">
        {items.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2), ease: [0.16, 1, 0.3, 1] }}
            className="panel group flex items-center gap-4 px-4 py-3.5 transition-colors duration-200 hover:border-border-strong"
          >
            <div className="w-14 shrink-0">
              <p className="tabular text-sm">{fmtTime(m.starts_at)}</p>
              <p className="text-[10px] text-muted-foreground">{m.duration_minutes} min</p>
            </div>
            <button onClick={() => setSelected(m)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm">{m.client?.name ?? m.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {[m.client?.company, m.client?.phone, m.notes].filter(Boolean).join(" · ") || "Sem detalhes"}
              </p>
            </button>
            <StatusBadge status={m.status} />
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
              {m.status !== "confirmada" && m.status !== "realizada" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => update.mutate({ id: m.id, status: "confirmada" })}
                >
                  Confirmar
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setReschedule(m)}>
                Remarcar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => update.mutate({ id: m.id, status: "realizada" })}
              >
                Realizada
              </Button>
            </div>
          </motion.div>
        ))}

        {items.length === 0 && (
          <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
            <CalendarDays className="size-5 text-muted-foreground" />
            <p className="text-sm">Nenhuma reunião neste dia.</p>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" /> Agendar reunião
            </Button>
          </div>
        )}
      </div>

      <MeetingDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} meeting={selected} />
      <MeetingDialog open={creating} onOpenChange={setCreating} initialDate={day} compact />
      <RescheduleDialog
        open={!!reschedule}
        onOpenChange={(o) => !o && setReschedule(null)}
        meeting={reschedule}
      />
    </div>
  );
}
