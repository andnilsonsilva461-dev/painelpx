import {
  addDays,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const L = { locale: ptBR };

export const fmtTime = (d: Date | string) => format(new Date(d), "HH:mm");
export const fmtDay = (d: Date | string) => format(new Date(d), "d MMM", L);
export const fmtFull = (d: Date | string) => format(new Date(d), "EEEE, d 'de' MMMM", L);
export const fmtDateTimeInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function relativeDayLabel(d: Date | string) {
  const date = new Date(d);
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  return format(date, "EEE, d MMM", L);
}

export function weekRange(anchor: Date) {
  return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 7) };
}

export function monthGridRange(anchor: Date) {
  const from = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const to = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1);
  return { from, to };
}

export { addDays, isSameDay, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, isToday };
