import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, PhoneCall, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveMeeting } from "@/lib/data";
import { fmtTime, relativeDayLabel } from "@/lib/dates";
import { SOURCES, SOURCE_LABEL, type LeadSource } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modo-ligacao")({
  head: () => ({
    meta: [
      { title: "Modo ligação — Orbit" },
      {
        name: "description",
        content: "Agende reuniões em segundos enquanto fala com o lead em lives e ligações.",
      },
      { property: "og:title", content: "Modo ligação — Orbit" },
      { property: "og:description", content: "Entrada ultrarrápida de reuniões durante a prospecção." },
    ],
  }),
  component: CallModePage,
});

/** Quick slot presets, resolved relative to "now". */
const SLOTS: { label: string; hint: string; resolve: () => Date }[] = [
  { label: "Em 1h", hint: "hoje", resolve: () => shift(60) },
  { label: "Em 2h", hint: "hoje", resolve: () => shift(120) },
  { label: "Hoje 14h", hint: "tarde", resolve: () => at(0, 14) },
  { label: "Hoje 17h", hint: "fim do dia", resolve: () => at(0, 17) },
  { label: "Amanhã 10h", hint: "manhã", resolve: () => at(1, 10) },
  { label: "Amanhã 15h", hint: "tarde", resolve: () => at(1, 15) },
  { label: "Depois 10h", hint: "em 2 dias", resolve: () => at(2, 10) },
  { label: "Semana que vem", hint: "seg 10h", resolve: nextMonday },
];

function shift(min: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + min, 0, 0);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}
function at(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  d.setHours(10, 0, 0, 0);
  return d;
}

const DURATIONS = [15, 30, 45, 60];

export default function CallModePage() {
  const save = useSaveMeeting();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [slot, setSlot] = useState(0);
  const [duration, setDuration] = useState(30);
  const [source, setSource] = useState<LeadSource>("live");
  const [streak, setStreak] = useState<{ name: string; at: Date }[]>([]);

  const startsAt = useMemo(() => SLOTS[slot].resolve(), [slot]);
  const canSave = name.trim().length > 1 && !save.isPending;

  async function submit() {
    if (!canSave) return;
    const when = SLOTS[slot].resolve();
    try {
      await save.mutateAsync({
        clientName: name.trim(),
        phone: phone.trim() || null,
        startsAt: when,
        durationMinutes: duration,
        source,
        status: "agendada",
        notes: notes.trim() || null,
        reminderMinutes: 15,
      });
      setStreak((s) => [{ name: name.trim(), at: when }, ...s].slice(0, 8));
      setName("");
      setPhone("");
      setNotes("");
      nameRef.current?.focus();
      toast.success("Agendado", { description: `${relativeDayLabel(when)} · ${fmtTime(when)}` });
    } catch {
      toast.error("Não foi possível agendar");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-2.5"
      >
        <span className="grid size-8 place-items-center rounded-md border border-border bg-elevated">
          <PhoneCall className="size-4" />
        </span>
        <div>
          <h1 className="text-2xl font-medium leading-none">Modo ligação</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Nome, horário, Enter. Feito em menos de 15 segundos.
          </p>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="panel p-5 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-6"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] text-muted-foreground">Nome do lead</label>
                <Input
                  ref={nameRef}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Marina Prado"
                  className="h-10 text-[15px]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] text-muted-foreground">WhatsApp (opcional)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                  className="h-10 text-[15px]"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">Quando</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SLOTS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSlot(i)}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-left transition-all duration-200",
                      slot === i
                        ? "border-foreground/25 bg-elevated"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <span className="block text-[12px] font-medium">{s.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{s.hint}</span>
                  </button>
                ))}
              </div>
              <p className="tabular mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {relativeDayLabel(startsAt)} às {fmtTime(startsAt)}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] text-muted-foreground">Duração</p>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        "tabular rounded-md border px-2.5 py-1.5 text-[12px] transition-colors duration-200",
                        duration === d
                          ? "border-foreground/25 bg-elevated"
                          : "border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] text-muted-foreground">Origem</p>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[12px] transition-colors duration-200",
                        source === s
                          ? "border-foreground/25 bg-elevated"
                          : "border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      {SOURCE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-muted-foreground">Anotação rápida</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Contexto da conversa, dor principal, objeção…"
                className="resize-none text-[13px]"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 text-[10px]">Enter</kbd> para
                agendar e limpar
              </p>
              <Button type="submit" disabled={!canSave} className="h-9 gap-1.5">
                <Zap className="size-3.5" />
                {save.isPending ? "Agendando…" : "Agendar"}
              </Button>
            </div>
          </form>
        </section>

        <aside className="panel h-fit overflow-hidden">
          <div className="hairline px-4 py-3">
            <h2 className="text-[13px] font-medium">Nesta sessão</h2>
            <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
              {streak.length} {streak.length === 1 ? "reunião agendada" : "reuniões agendadas"}
            </p>
          </div>
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {streak.map((s, i) => (
                <motion.div
                  key={`${s.name}-${i}-${s.at.toISOString()}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                >
                  <Check className="size-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[12px]">{s.name}</span>
                  <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                    {relativeDayLabel(s.at)} {fmtTime(s.at)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {!streak.length && (
              <p className="flex items-center gap-2 px-4 py-8 text-center text-[11px] text-muted-foreground">
                <Undo2 className="size-3" />
                Os agendamentos desta sessão aparecem aqui.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
