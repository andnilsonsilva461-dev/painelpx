import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Radio, Search, Square, Target, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  OUTCOMES,
  OUTCOME_EMOJI,
  OUTCOME_LABEL,
  summarize,
  useDeleteProspect,
  useEndLive,
  useLiveSessions,
  useProspectRealtime,
  useProspects,
  useSaveProspect,
  useStartLive,
  useUpdateLive,
  useUpdateProspect,
  type Prospect,
  type ProspectOutcome,
} from "@/lib/prospects";
import { SOURCE_LABEL } from "@/lib/domain";
import { fmtDateTimeInput, fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prospeccao")({
  head: () => ({
    meta: [
      { title: "Prospecção ao vivo — Orbit" },
      {
        name: "description",
        content: "Registre cada pessoa abordada durante a live em um clique e acompanhe seus resultados em tempo real.",
      },
      { property: "og:title", content: "Prospecção ao vivo — Orbit" },
      { property: "og:description", content: "Centro de operação para prospecção durante lives." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProspectPage,
});

type Period = "hoje" | "ontem" | "semana" | "mes" | "live";

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "live", label: "Live atual" },
];

const TONE_CLASS: Record<string, string> = {
  success: "border-success/30 bg-success/10 hover:bg-success/15 text-success",
  accent: "border-accent/30 bg-accent/10 hover:bg-accent/15 text-accent",
  warning: "border-warning/35 bg-warning/10 hover:bg-warning/15 text-warning",
  danger: "border-destructive/30 bg-destructive/10 hover:bg-destructive/15 text-destructive",
  neutral: "border-border bg-surface hover:bg-elevated text-muted-foreground",
};

function startOf(period: Period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "ontem") d.setDate(d.getDate() - 1);
  if (period === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "mes") d.setDate(1);
  return d;
}

function roundedNow(minutesAhead = 60) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesAhead, 0, 0);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

function ProspectPage() {
  useProspectRealtime();
  const { data: prospects } = useProspects();
  const { data: sessions } = useLiveSessions();
  const save = useSaveProspect();
  const update = useUpdateProspect();
  const remove = useDeleteProspect();
  const startLive = useStartLive();
  const endLive = useEndLive();
  const updateLive = useUpdateLive();

  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  const [period, setPeriod] = useState<Period>("hoje");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<"agendou" | "ligar_depois" | null>(null);
  const [when, setWhen] = useState(() => fmtDateTimeInput(roundedNow()));
  const [duration, setDuration] = useState(30);
  const [callbackNote, setCallbackNote] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  const active = useMemo(() => (sessions ?? []).find((s) => !s.ended_at) ?? null, [sessions]);
  const all = prospects ?? [];

  const today = useMemo(() => {
    const from = startOf("hoje");
    return all.filter((p) => new Date(p.created_at) >= from);
  }, [all]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = all;
    if (period === "live") {
      list = active ? all.filter((p) => p.session_id === active.id) : [];
    } else {
      const from = startOf(period);
      const to = new Date(from);
      to.setDate(to.getDate() + (period === "ontem" ? 1 : 3650));
      list = all.filter((p) => {
        const d = new Date(p.created_at);
        return d >= from && d < to;
      });
    }
    if (!term) return list;
    return list.filter((p) =>
      [p.name, p.phone, p.company, p.instagram, p.notes, OUTCOME_LABEL[p.outcome]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [all, period, q, active]);

  const liveRows = useMemo(() => (active ? all.filter((p) => p.session_id === active.id) : []), [all, active]);
  const counters = summarize(today);
  const liveStats = summarize(liveRows);
  const goal = active?.goal ?? 100;
  const progress = Math.min(100, goal ? (liveRows.length / goal) * 100 : 0);

  const dash = useMemo(() => {
    const week = all.filter((p) => new Date(p.created_at) >= startOf("semana"));
    const month = all.filter((p) => new Date(p.created_at) >= startOf("mes"));
    const scheduled = month.filter((p) => p.outcome === "agendou" && p.meeting_id);
    return {
      day: today.length,
      week: week.length,
      month: month.length,
      meetings: month.filter((p) => p.outcome === "agendou").length,
      clients: month.filter((p) => p.outcome === "virou_cliente").length,
      conversion: summarize(month).conversionRate,
      scheduled: scheduled.length,
    };
  }, [all, today]);

  function reset() {
    setName("");
    setPhone("");
    setInstagram("");
    setCompany("");
    setNotes("");
    setPending(null);
    setCallbackNote("");
    nameRef.current?.focus();
  }

  async function commit(outcome: (typeof OUTCOMES)[number]["value"], extra?: { meetingAt?: Date; callbackAt?: Date }) {
    if (name.trim().length < 2) {
      toast.error("Informe o nome do lead");
      nameRef.current?.focus();
      return;
    }
    try {
      await save.mutateAsync({
        name,
        phone,
        instagram,
        company,
        notes: outcome === "ligar_depois" ? callbackNote || notes : notes,
        outcome,
        sessionId: active?.id ?? null,
        meetingAt: extra?.meetingAt ?? null,
        callbackAt: extra?.callbackAt ?? null,
        durationMinutes: duration,
      });
      toast.success(`${OUTCOME_EMOJI[outcome]} ${OUTCOME_LABEL[outcome]}`, { description: name.trim() });
      reset();
    } catch {
      toast.error("Não foi possível salvar");
    }
  }

  function handleOutcome(outcome: (typeof OUTCOMES)[number]["value"]) {
    if (name.trim().length < 2) {
      toast.error("Informe o nome do lead");
      nameRef.current?.focus();
      return;
    }
    if (outcome === "agendou" || outcome === "ligar_depois") {
      setWhen(fmtDateTimeInput(roundedNow(outcome === "agendou" ? 60 : 1440)));
      setPending(outcome);
      return;
    }
    void commit(outcome);
  }

  /* keyboard shortcuts — work from anywhere on the page */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (pending) setPending(null);
        else reset();
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing && !e.shiftKey) return;
      const hit = OUTCOMES.find((o) => o.key === e.key.toLowerCase());
      if (!hit) return;
      e.preventDefault();
      handleOutcome(hit.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:py-10">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-8 place-items-center rounded-md border",
              active ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-elevated",
            )}
          >
            <Radio className="size-4" />
          </span>
          <div>
            <h1 className="text-2xl font-medium leading-none">Prospecção</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {active
                ? `Live em andamento desde ${fmtTime(active.started_at)}`
                : "Inicie a live e registre cada abordagem em um clique."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active ? (
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              onClick={async () => {
                await endLive.mutateAsync(active.id);
                setStatsOpen(true);
              }}
            >
              <Square className="size-3.5" /> Encerrar live
            </Button>
          ) : (
            <Button className="h-9 gap-1.5" onClick={() => startLive.mutate(100)}>
              <Play className="size-3.5" /> Iniciar live
            </Button>
          )}
        </div>
      </div>

      {/* goal */}
      {active && (
        <section className="panel mt-6 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px]">
              <Target className="size-3.5 text-muted-foreground" />
              <span className="font-medium">Meta da live</span>
              <span className="tabular text-muted-foreground">
                {liveRows.length} / {goal}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder={String(goal)}
                inputMode="numeric"
                className="h-8 w-20 text-[13px]"
              />
              <Button
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => {
                  const n = Number(goalDraft);
                  if (!Number.isFinite(n) || n < 1 || n > 10000) return toast.error("Meta inválida");
                  updateLive.mutate({ id: active.id, values: { goal: Math.round(n) } });
                  setGoalDraft("");
                }}
              >
                Definir meta
              </Button>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </section>
      )}

      {/* counters */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "👥 Prospectados hoje", value: counters.total },
          { label: "📅 Reuniões marcadas", value: counters.meetings },
          { label: "🔁 Retornos", value: counters.callbacks },
          { label: "❌ Não interessados", value: counters.rejected },
          { label: "📞 Não atenderam", value: counters.noAnswer },
          { label: "💰 Clientes fechados", value: counters.clients },
        ].map((c) => (
          <div key={c.label} className="panel px-3.5 py-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="tabular mt-1 text-xl font-medium">{c.value}</p>
          </div>
        ))}
      </div>

      {/* capture */}
      <section className="panel mt-6 p-4 sm:p-5">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            ref={nameRef}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do lead"
            maxLength={120}
            className="h-10 text-[15px]"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="Telefone (opcional)"
            maxLength={40}
            className="h-10 text-[14px]"
          />
          <Input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@instagram (opcional)"
            maxLength={80}
            className="h-10 text-[14px]"
          />
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Empresa (opcional)"
            maxLength={120}
            className="h-10 text-[14px]"
          />
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={800}
          placeholder="Observação rápida…"
          className="mt-2.5 resize-none text-[13px]"
        />

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={save.isPending}
              onClick={() => handleOutcome(o.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-all duration-150 active:scale-[0.98] disabled:opacity-60",
                TONE_CLASS[o.tone],
              )}
            >
              <span className="text-base leading-none">{o.emoji}</span>
              <span className="text-[13px] font-medium text-foreground">{o.label}</span>
              <span className="text-[10px] uppercase text-muted-foreground">tecla {o.key}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Atalhos: A agendou · R retorno · N não interessado · P vai pensar · C cliente · T não atendeu · Esc limpa.
        </p>
      </section>

      {/* filters + search */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors duration-150",
                period === p.value ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar lead…"
            maxLength={120}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      {/* table */}
      <div className="panel mt-4 overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_0.9fr_1fr_0.5fr_0.6fr_1.2fr_auto] gap-3 px-4 py-2.5 text-[11px] text-muted-foreground hairline md:grid">
          <span>Nome</span>
          <span>Telefone</span>
          <span>Status</span>
          <span>Horário</span>
          <span>Origem</span>
          <span>Observações</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {rows.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 items-center gap-1.5 px-4 py-2 text-[13px] md:grid-cols-[1.2fr_0.9fr_1fr_0.5fr_0.6fr_1.2fr_auto] md:gap-3"
              >
                <EditableCell value={p.name} onSave={(v) => update.mutate({ id: p.id, values: { name: v } })} />
                <EditableCell
                  value={p.phone ?? ""}
                  placeholder="—"
                  onSave={(v) => update.mutate({ id: p.id, values: { phone: v || null } })}
                />
                <select
                  value={p.outcome}
                  onChange={(e) =>
                    update.mutate({ id: p.id, values: { outcome: e.target.value as ProspectOutcome } })
                  }
                  className="h-7 rounded-md border border-border bg-surface px-1.5 text-[12px]"
                >
                  {Object.keys(OUTCOME_LABEL).map((o) => (
                    <option key={o} value={o}>
                      {OUTCOME_EMOJI[o as ProspectOutcome]} {OUTCOME_LABEL[o as ProspectOutcome]}
                    </option>
                  ))}
                </select>
                <span className="tabular text-muted-foreground">{fmtTime(p.created_at)}</span>
                <span className="truncate text-muted-foreground">{SOURCE_LABEL[p.source]}</span>
                <EditableCell
                  value={p.notes ?? ""}
                  placeholder="—"
                  onSave={(v) => update.mutate({ id: p.id, values: { notes: v || null } })}
                />
                <button
                  onClick={() => remove.mutate(p.id)}
                  className="justify-self-end text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remover ${p.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Zap className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhuma prospecção neste período.</p>
            </div>
          )}
        </div>
      </div>

      {/* dashboard */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Leads do dia", value: dash.day },
          { label: "Leads da semana", value: dash.week },
          { label: "Leads do mês", value: dash.month },
          { label: "Agendamentos", value: dash.meetings },
          { label: "Clientes", value: dash.clients },
          { label: "Conversão", value: `${dash.conversion}%` },
          { label: "Tempo médio p/ reunião", value: avgTimeToMeeting(all) },
        ].map((c) => (
          <div key={c.label} className="panel px-3.5 py-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="tabular mt-1 text-lg font-medium">{c.value}</p>
          </div>
        ))}
      </section>

      {/* schedule / callback dialog */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {pending === "agendou" ? "Agendar reunião" : "Retornar depois"} · {name || "Lead"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] text-muted-foreground">Data e hora</label>
              <Input
                type="datetime-local"
                autoFocus
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="h-10 text-[14px]"
              />
            </div>
            {pending === "agendou" ? (
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground">Duração</p>
                <div className="flex gap-1.5">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "tabular rounded-md border px-2.5 py-1.5 text-[12px]",
                        duration === d ? "border-foreground/25 bg-elevated" : "border-border bg-surface",
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[11px] text-muted-foreground">Observação</label>
                <Textarea
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="resize-none text-[13px]"
                  placeholder="Motivo do retorno…"
                />
              </div>
            )}
            <Button
              className="h-9 w-full"
              disabled={save.isPending}
              onClick={() => {
                const date = new Date(when);
                if (Number.isNaN(date.getTime())) return toast.error("Data inválida");
                if (pending === "agendou") void commit("agendou", { meetingAt: date });
                else void commit("ligar_depois", { callbackAt: date });
              }}
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* live stats */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Resultado da live</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Tempo da live", value: liveDuration(sessions?.[0]?.started_at, sessions?.[0]?.ended_at) },
              { label: "Total prospectado", value: liveStats.total },
              { label: "Reuniões marcadas", value: liveStats.meetings },
              { label: "Clientes fechados", value: liveStats.clients },
              { label: "Taxa de agendamento", value: `${liveStats.scheduleRate}%` },
              { label: "Taxa de conversão", value: `${liveStats.conversionRate}%` },
              { label: "Taxa de rejeição", value: `${liveStats.rejectionRate}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border bg-surface px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="tabular mt-1 text-lg font-medium">{s.value}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableCell({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-elevated"
      >
        {value || placeholder || "—"}
      </button>
    );

  return (
    <Input
      autoFocus
      value={draft}
      maxLength={500}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-7 text-[12px]"
    />
  );
}

function liveDuration(start?: string | null, end?: string | null) {
  if (!start) return "—";
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

function avgTimeToMeeting(rows: Prospect[]) {
  const withMeeting = rows.filter((p) => p.outcome === "agendou" && p.callback_at === null && p.meeting_id);
  if (!withMeeting.length) return "—";
  const days =
    withMeeting.reduce((acc, p) => acc + (Date.now() - new Date(p.created_at).getTime()), 0) /
    withMeeting.length /
    86400000;
  return `${Math.max(0, Math.round(days * 10) / 10)}d`;
}
