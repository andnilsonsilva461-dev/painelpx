import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Clock3, TrendingUp, UserRound } from "lucide-react";
import { useAllMeetings, useClients } from "@/lib/data";
import {
  addDays,
  endOfDay,
  fmtTime,
  relativeDayLabel,
  startOfDay,
  startOfWeek,
  isSameDay,
  format,
} from "@/lib/dates";
import { L } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { MeetingDialog } from "@/components/MeetingDialog";
import type { MeetingWithClient } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Orbit" },
      { name: "description", content: "Visão geral da semana: reuniões de hoje, próximos compromissos e clientes aguardando contato." },
      { property: "og:title", content: "Painel — Orbit" },
      { property: "og:description", content: "Visão geral da semana de prospecção." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: meetings } = useAllMeetings();
  const { data: clients } = useClients();
  const [selected, setSelected] = useState<MeetingWithClient | null>(null);

  const now = new Date();
  const list = meetings ?? [];

  const today = list.filter((m) => isSameDay(new Date(m.starts_at), now));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const week = list.filter((m) => {
    const d = new Date(m.starts_at);
    return d >= weekStart && d < addDays(weekStart, 7);
  });
  const upcoming = list
    .filter((m) => new Date(m.starts_at) >= now && m.status !== "cancelada")
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const waiting = (clients ?? []).filter((c) => c.status === "aguardando");
  const overdue = list.filter(
    (m) => new Date(m.starts_at) < startOfDay(now) && ["agendada", "confirmada"].includes(m.status),
  );
  const done = list.filter((m) => m.status === "realizada").length;
  const past = list.filter((m) => new Date(m.starts_at) < now).length;
  const attendance = past ? Math.round((done / past) * 100) : 0;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.getTime()],
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-eyebrow">{format(now, "EEEE, d 'de' MMMM", L)}</p>
        <h1 className="mt-2 text-2xl font-medium">Painel</h1>
      </motion.header>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Hoje" value={today.length} hint="reuniões" />
        <Stat label="Semana" value={week.length} hint="reuniões" />
        <Stat
          label="Próxima"
          value={upcoming[0] ? fmtTime(upcoming[0].starts_at) : "—"}
          hint={upcoming[0] ? (upcoming[0].client?.name ?? "") : "sem agenda"}
        />
        <Stat label="Aguardando" value={waiting.length} hint="clientes" />
        <Stat label="Atrasados" value={overdue.length} hint="sem desfecho" tone={overdue.length ? "warn" : undefined} />
        <Stat label="Comparecimento" value={`${attendance}%`} hint="realizadas" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Semana</h2>
            <Link to="/calendario" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Calendário <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const items = list.filter((m) => isSameDay(new Date(m.starts_at), day));
              const isToday = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className="min-h-[168px] border-r border-border p-2 last:border-r-0">
                  <div className="mb-2 flex items-baseline gap-1.5 px-1">
                    <span className="text-[10px] uppercase text-muted-foreground">{format(day, "EEEEEE", L)}</span>
                    <span
                      className={cn(
                        "tabular text-xs",
                        isToday ? "font-semibold text-accent" : "text-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 4).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className="block w-full truncate rounded border border-border bg-elevated px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:border-border-strong"
                      >
                        <span className="tabular text-muted-foreground">{fmtTime(m.starts_at)}</span>{" "}
                        {m.client?.name ?? m.title}
                      </button>
                    ))}
                    {items.length > 4 && (
                      <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 4}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Próximas reuniões</h2>
            <Link to="/agenda" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Ver agenda
            </Link>
          </div>
          <div className="divide-y divide-border">
            {upcoming.slice(0, 6).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="row-hover flex w-full items-center gap-3 px-5 py-3 text-left"
              >
                <div className="tabular w-12 shrink-0 text-[13px] text-muted-foreground">{fmtTime(m.starts_at)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{m.client?.name ?? m.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {relativeDayLabel(m.starts_at)}
                    {m.client?.company ? ` · ${m.client.company}` : ""}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </button>
            ))}
            {upcoming.length === 0 && (
              <Empty icon={CalendarClock} text="Nenhuma reunião futura agendada." />
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Hoje</h2>
          </div>
          <div className="divide-y divide-border">
            {today.map((m) => (
              <button key={m.id} onClick={() => setSelected(m)} className="row-hover flex w-full items-center gap-3 px-5 py-3 text-left">
                <span className="tabular w-12 text-[13px] text-muted-foreground">{fmtTime(m.starts_at)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{m.client?.name ?? m.title}</span>
                <StatusBadge status={m.status} />
              </button>
            ))}
            {today.length === 0 && <Empty icon={Clock3} text="Dia livre." />}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="px-5 py-3.5 hairline">
            <h2 className="text-[13px] font-medium">Clientes aguardando contato</h2>
          </div>
          <div className="divide-y divide-border">
            {waiting.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/clientes/$clientId"
                params={{ clientId: c.id }}
                className="row-hover flex items-center gap-3 px-5 py-3"
              >
                <UserRound className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{c.company ?? c.phone ?? ""}</span>
              </Link>
            ))}
            {waiting.length === 0 && <Empty icon={TrendingUp} text="Nenhum cliente na fila." />}
          </div>
        </section>
      </div>

      <MeetingDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} meeting={selected} />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div className="bg-surface px-4 py-4 transition-colors duration-200 hover:bg-elevated">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1.5 text-xl font-medium", tone === "warn" && "text-warning")}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
