import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DURATIONS,
  REMINDERS,
  SOURCES,
  SOURCE_LABEL,
  STATUSES,
  STATUS_LABEL,
  type MeetingStatus,
  type LeadSource,
  type MeetingWithClient,
} from "@/lib/domain";
import { useDeleteMeeting, useSaveMeeting } from "@/lib/data";
import { fmtDateTimeInput } from "@/lib/dates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: MeetingWithClient | null;
  initialDate?: Date | null;
  compact?: boolean;
};

const empty = {
  clientName: "",
  phone: "",
  company: "",
  instagram: "",
  email: "",
  notes: "",
};

export function MeetingDialog({ open, onOpenChange, meeting, initialDate, compact }: Props) {
  const save = useSaveMeeting();
  const remove = useDeleteMeeting();
  const [form, setForm] = useState(empty);
  const [when, setWhen] = useState(() => fmtDateTimeInput(initialDate ?? new Date()));
  const [duration, setDuration] = useState("30");
  const [source, setSource] = useState<LeadSource>("live");
  const [status, setStatus] = useState<MeetingStatus>("agendada");
  const [offsets, setOffsets] = useState<number[]>(DEFAULT_OFFSETS);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (!open) return;
    setExpanded(!compact);
    if (meeting) {
      setForm({
        clientName: meeting.client?.name ?? meeting.title ?? "",
        phone: meeting.client?.phone ?? "",
        company: meeting.client?.company ?? "",
        instagram: meeting.client?.instagram ?? "",
        email: meeting.client?.email ?? "",
        notes: meeting.notes ?? "",
      });
      setWhen(fmtDateTimeInput(new Date(meeting.starts_at)));
      setDuration(String(meeting.duration_minutes));
      setSource(meeting.source);
      setStatus(meeting.status);
      setOffsets(meeting.reminder_offsets ?? DEFAULT_OFFSETS);
    } else {
      setForm(empty);
      setWhen(fmtDateTimeInput(initialDate ?? nextSlot()));
      setDuration("30");
      setSource("live");
      setStatus("agendada");
      setOffsets(defaults);
    }
  }, [open, meeting, initialDate, compact]);

  const valid = form.clientName.trim().length > 1 && when.length > 0;

  async function submit() {
    if (!valid) return;
    try {
      await save.mutateAsync({
        id: meeting?.id,
        clientId: meeting?.client_id ?? null,
        clientName: form.clientName.trim().slice(0, 120),
        phone: form.phone.trim().slice(0, 40) || null,
        company: form.company.trim().slice(0, 120) || null,
        instagram: form.instagram.trim().replace(/^@/, "").slice(0, 60) || null,
        email: form.email.trim().slice(0, 160) || null,
        startsAt: new Date(when),
        durationMinutes: Number(duration),
        source,
        status,
        notes: form.notes.trim().slice(0, 5000) || null,
        reminderMinutes: offsets.length ? Math.min(...offsets.filter((o) => o > 0), 15) : 15,
        reminderOffsets: offsets,
      });
      toast.success(meeting ? "Reunião atualizada" : "Reunião agendada");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] gap-0 overflow-y-auto border-border bg-surface p-0 sm:max-w-[560px]"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
        }}
      >
        <DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-base font-medium">
            {meeting ? "Editar reunião" : "Nova reunião"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Preencha o essencial e salve com ⌘/Ctrl + Enter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" required>
              <Input autoFocus value={form.clientName} onChange={set("clientName")} placeholder="João Silva" />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-0000" inputMode="tel" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data e hora" required>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
            <Field label="Duração">
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Origem">
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Mais detalhes (empresa, Instagram, e-mail, status)
            </button>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Empresa"><Input value={form.company} onChange={set("company")} /></Field>
                <Field label="Instagram"><Input value={form.instagram} onChange={set("instagram")} placeholder="@perfil" /></Field>
                <Field label="E-mail"><Input value={form.email} onChange={set("email")} type="email" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <Select value={status} onValueChange={(v) => setStatus(v as MeetingStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Lembretes">
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_OFFSETS.map((r) => {
                    const on = offsets.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() =>
                          setOffsets((cur) =>
                            cur.includes(r.value)
                              ? cur.filter((o) => o !== r.value)
                              : [...cur, r.value].sort((a, b) => b - a),
                          )
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[12px] transition-all duration-200",
                          on
                            ? "border-foreground/25 bg-elevated"
                            : "border-border bg-surface hover:border-border-strong",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={set("notes")}
              rows={expanded ? 6 : 3}
              placeholder="Tudo que o cliente falou durante a ligação…"
              className="resize-none"
            />
          </Field>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-6 py-4">
          <div>
            {meeting && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  await remove.mutateAsync(meeting);
                  toast.success("Reunião removida");
                  onOpenChange(false);
                }}
              >
                <Trash2 className="size-3.5" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" disabled={!valid || save.isPending} onClick={submit}>
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
              {meeting ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-accent"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function nextSlot() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

export function useNextSlot() {
  return useMemo(nextSlot, []);
}
