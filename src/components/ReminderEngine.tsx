import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMeetings } from "@/lib/data";
import { addDays, fmtTime } from "@/lib/dates";

/**
 * Watches upcoming meetings and fires an in-app toast + browser notification
 * when the configured reminder window is reached.
 */
export function ReminderEngine() {
  const { data: meetings } = useMeetings({ from: new Date(Date.now() - 3_600_000), to: addDays(new Date(), 2) });
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") void Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!meetings?.length) return;

    const tick = async () => {
      const now = Date.now();
      for (const m of meetings) {
        if (m.reminder_fired || fired.current.has(m.id)) continue;
        if (m.status === "cancelada" || m.status === "realizada") continue;
        const start = new Date(m.starts_at).getTime();
        const due = start - m.reminder_minutes * 60_000;
        if (now < due || now > start + 60_000) continue;

        fired.current.add(m.id);
        const title = `Reunião ${fmtTime(m.starts_at)} — ${m.client?.name ?? m.title ?? "Cliente"}`;
        toast(title, { description: m.notes?.slice(0, 120) ?? "Lembrete de compromisso", duration: 12_000 });

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body: m.notes?.slice(0, 140) ?? "Reunião de prospecção" });
        }

        await supabase.from("meetings").update({ reminder_fired: true }).eq("id", m.id);
        await supabase.from("notifications").insert({
          user_id: m.user_id,
          meeting_id: m.id,
          title,
          message: m.notes?.slice(0, 200) ?? null,
        });
      }
    };

    void tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [meetings]);

  return null;
}
