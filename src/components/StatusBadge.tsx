import { STATUS_LABEL, STATUS_TONE, type MeetingStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  accent: "border-accent/30 bg-accent/10 text-accent",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium leading-none",
        TONE[STATUS_TONE[status]],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Dot({ status }: { status: MeetingStatus }) {
  const tone = STATUS_TONE[status];
  const bg =
    tone === "success"
      ? "bg-success"
      : tone === "accent"
        ? "bg-accent"
        : tone === "warning"
          ? "bg-warning"
          : tone === "danger"
            ? "bg-destructive"
            : "bg-muted-foreground";
  return <span className={cn("size-1.5 shrink-0 rounded-full", bg)} />;
}
