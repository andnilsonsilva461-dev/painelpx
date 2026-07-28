import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRescheduleMeeting } from "@/lib/data";
import { addDays, fmtDateTimeInput } from "@/lib/dates";
import type { MeetingWithClient } from "@/lib/domain";

const QUICK = [
  { label: "Amanhã", days: 1 },
  { label: "Em 2 dias", days: 2 },
  { label: "Próxima semana", days: 7 },
];

export function RescheduleDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: MeetingWithClient | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const reschedule = useRescheduleMeeting();
  const [when, setWhen] = useState("");

  const value = when || (meeting ? fmtDateTimeInput(new Date(meeting.starts_at)) : "");

  async function submit() {
    if (!meeting || !value) return;
    await reschedule.mutateAsync({ meeting, newDate: new Date(value) });
    toast.success("Reunião reagendada");
    setWhen("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Reagendar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{meeting?.client?.name ?? meeting?.title}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <Button
                key={q.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  const base = meeting ? new Date(meeting.starts_at) : new Date();
                  setWhen(fmtDateTimeInput(addDays(base, q.days)));
                }}
              >
                {q.label}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Nova data e hora</Label>
            <Input type="datetime-local" value={value} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={reschedule.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
