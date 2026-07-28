import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/MeetingDialog";
import { Dot, StatusBadge } from "@/components/StatusBadge";
import { useAllMeetings } from "@/lib/data";
import {
  addDays,
  format,
  isSameDay,
  L,
  monthGridRange,
  startOfDay,
  startOfMonth,
  startOfWeek,
  fmtTime,
} from "@/lib/dates";
import type { MeetingWithClient } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Orbit" },
      { name: "description", content: "Calendário de reuniões em visualização de dia, semana e mês." },
      { property: "og:title", content: "Calendário — Orbit" },
      { property: "og:description", content: "Calendário de reuniões em dia, semana e mês." },
    ],
  }),
  component: CalendarPage,
});

type View = "dia" | "semana" | "mes";
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 → 21:00

function CalendarPage() {
  const { data: meetings } = useAllMeetings();
  const [view, setView] = useState<View>("semana");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<MeetingWithClient | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);

  const list = meetings ?? [];

  const days = useMemo(() => {
    if (view === "dia") return [startOfDay(anchor)];
    if (view === "semana") {
      const s = startOfWeek(anchor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const { from } = monthGridRange(anchor);
    return Array.from({ length: 42 }, (_, i) => addDays(from, i));
  }, [view, anchor]);

  const step = view === "mes" ? "month" : view === "semana" ? "week" : "day";
  const move = (dir: 1 | -1) => {
    if (step === "month") {
      const d = new Date(anchor);
      d.setMonth(d.getMonth() + dir);
      setAnchor(startOfMonth(d));
    } else setAnchor(addDays(anchor, dir * (step === "week" ? 7 : 1)));
  };

  const title =
    view === "mes"
      ? format(anchor, "MMMM yyyy", L)
      : view === "semana"
        ? `${format(days[0], "d MMM", L)} – ${format(days[6], "d MMM", L)}`
        : format(anchor, "EEEE, d 'de' MMMM", L);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => move(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h1 className="text-[15px] font-medium capitalize">{title}</h1>
        <Button variant="outline" size="sm" className="h-7" onClick={() => setAnchor(new Date())}>
          Hoje
        </Button>

        <div className="ml-auto flex items-center rounded-md border border-border bg-surface p-0.5">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2.5 py-1 text-xs capitalize transition-colors duration-150",
                view === v ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "mes" ? "mês" : v}
            </button>
          ))}
        </div>
      </div>

      {view === "mes" ? (
        <div className="grid flex-1 grid-cols-7 overflow-auto">
          {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
            <div key={d} className="border-b border-r border-border px-2 py-1.5 text-[10px] uppercase text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const items = list.filter((m) => isSameDay(new Date(m.starts_at), day));
            const other = day.getMonth() !== anchor.getMonth();
            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  const d = new Date(day);
                  d.setHours(9, 0, 0, 0);
                  setSlot(d);
                  setCreating(true);
                }}
                className={cn(
                  "min-h-[104px] cursor-pointer border-b border-r border-border p-1.5 transition-colors hover:bg-elevated",
                  other && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "tabular text-[11px]",
                    isSameDay(day, new Date()) ? "font-semibold text-accent" : "text-muted-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((m) => (
                    <button
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(m);
                      }}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-muted"
                    >
                      <Dot status={m.status} />
                      <span className="tabular text-muted-foreground">{fmtTime(m.starts_at)}</span>
                      <span className="truncate">{m.client?.name ?? m.title}</span>
                    </button>
                  ))}
                  {items.length > 3 && <p className="pl-1 text-[10px] text-muted-foreground">+{items.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div
            className="grid min-w-[640px]"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
          >
            <div className="sticky top-0 z-10 border-b border-r border-border bg-background" />
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className="sticky top-0 z-10 border-b border-r border-border bg-background px-2 py-2 text-center"
              >
                <p className="text-[10px] uppercase text-muted-foreground">{format(d, "EEE", L)}</p>
                <p
                  className={cn(
                    "tabular text-sm",
                    isSameDay(d, new Date()) ? "font-semibold text-accent" : "",
                  )}
                >
                  {format(d, "d")}
                </p>
              </div>
            ))}

            {HOURS.map((h) => (
              <div key={h} className="contents">
                <div className="border-b border-r border-border px-2 py-1 text-right text-[10px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
                {days.map((d) => {
                  const cellStart = new Date(d);
                  cellStart.setHours(h, 0, 0, 0);
                  const items = list.filter((m) => {
                    const md = new Date(m.starts_at);
                    return isSameDay(md, d) && md.getHours() === h;
                  });
                  return (
                    <div
                      key={d.toISOString() + h}
                      onClick={() => {
                        setSlot(cellStart);
                        setCreating(true);
                      }}
                      className="group relative min-h-[56px] cursor-pointer border-b border-r border-border p-1 transition-colors hover:bg-elevated"
                    >
                      {items.map((m) => (
                        <button
                          key={m.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(m);
                          }}
                          className="mb-1 block w-full rounded-md border border-border bg-surface px-1.5 py-1 text-left shadow-[var(--shadow-soft)] transition-transform duration-150 hover:-translate-y-px"
                        >
                          <div className="flex items-center gap-1">
                            <Dot status={m.status} />
                            <span className="tabular text-[10px] text-muted-foreground">{fmtTime(m.starts_at)}</span>
                          </div>
                          <p className="truncate text-[11px] leading-tight">{m.client?.name ?? m.title}</p>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <MeetingDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} meeting={selected} />
      <MeetingDialog open={creating} onOpenChange={setCreating} initialDate={slot} compact />
    </div>
  );
}
