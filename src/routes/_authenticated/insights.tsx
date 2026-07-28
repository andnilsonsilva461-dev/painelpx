import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAllMeetings, useClients } from "@/lib/data";
import { addDays, format, isSameDay, L, startOfWeek } from "@/lib/dates";
import { SOURCE_LABEL, STATUS_LABEL, type LeadSource, type MeetingStatus } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Orbit" },
      { name: "description", content: "Taxa de comparecimento, origem dos leads, dias mais movimentados e evolução das reuniões." },
      { property: "og:title", content: "Insights — Orbit" },
      { property: "og:description", content: "Estatísticas da sua prospecção comercial." },
    ],
  }),
  component: InsightsPage,
});

const AXIS = { fontSize: 10, fill: "var(--color-muted-foreground)" };

function InsightsPage() {
  const { data: meetings } = useAllMeetings();
  const { data: clients } = useClients();
  const list = meetings ?? [];

  const byStatus = useMemo(() => {
    const acc = {} as Record<MeetingStatus, number>;
    for (const m of list) acc[m.status] = (acc[m.status] ?? 0) + 1;
    return (Object.keys(STATUS_LABEL) as MeetingStatus[]).map((s) => ({
      name: STATUS_LABEL[s],
      value: acc[s] ?? 0,
    }));
  }, [list]);

  const bySource = useMemo(() => {
    const acc = {} as Record<LeadSource, number>;
    for (const c of clients ?? []) acc[c.source] = (acc[c.source] ?? 0) + 1;
    return (Object.keys(SOURCE_LABEL) as LeadSource[])
      .map((s) => ({ name: SOURCE_LABEL[s], value: acc[s] ?? 0 }))
      .filter((r) => r.value > 0);
  }, [clients]);

  const last8Weeks = useMemo(() => {
    const start = startOfWeek(addDays(new Date(), -7 * 7), { weekStartsOn: 1 });
    return Array.from({ length: 8 }, (_, i) => {
      const from = addDays(start, i * 7);
      const to = addDays(from, 7);
      const items = list.filter((m) => {
        const d = new Date(m.starts_at);
        return d >= from && d < to;
      });
      return {
        name: format(from, "d MMM", L),
        total: items.length,
        realizadas: items.filter((m) => m.status === "realizada").length,
      };
    });
  }, [list]);

  const weekdays = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, i);
      return {
        name: format(day, "EEE", L),
        value: list.filter((m) => new Date(m.starts_at).getDay() === day.getDay()).length,
      };
    });
  }, [list]);

  const past = list.filter((m) => new Date(m.starts_at) < new Date());
  const done = past.filter((m) => m.status === "realizada").length;
  const attendance = past.length ? Math.round((done / past.length) * 100) : 0;
  const cancelled = list.filter((m) => m.status === "cancelada").length;
  const rescheduled = list.filter((m) => m.status === "reagendada").length;
  const noShow = list.filter((m) => m.status === "nao_atendeu").length;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-medium">Insights</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Desempenho da sua prospecção ao longo do tempo.</p>
      </motion.div>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total" value={list.length} />
        <Kpi label="Realizadas" value={done} />
        <Kpi label="Comparecimento" value={`${attendance}%`} />
        <Kpi label="Reagendadas" value={rescheduled} />
        <Kpi label="Não atendeu" value={noShow} />
        <Kpi label="Canceladas" value={cancelled} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Evolução (8 semanas)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last8Weeks} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--color-border-strong)" }} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="realizadas"
                stroke="var(--color-accent)"
                strokeWidth={1.75}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Dias mais movimentados">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekdays} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-elevated)" }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} fill="var(--color-accent)" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Situação das reuniões">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byStatus} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={92} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-elevated)" }} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={i % 2 ? "var(--color-muted-foreground)" : "var(--color-accent)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Origem dos clientes">
          {bySource.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySource} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={92} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-elevated)" }} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} fill="var(--color-accent)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-xs text-muted-foreground">Sem dados suficientes ainda.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface px-4 py-4 transition-colors duration-200 hover:bg-elevated">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular mt-1.5 text-xl font-medium">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <div className="px-5 py-3.5 hairline">
        <h2 className="text-[13px] font-medium">{title}</h2>
      </div>
      <div className="px-2 py-4">{children}</div>
    </section>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-lift)]">
      <p className="text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular">
          {p.dataKey}: {p.value}
        </p>
      ))}
    </div>
  );
}
