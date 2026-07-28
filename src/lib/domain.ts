import type { Database } from "@/integrations/supabase/types";

export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type MeetingStatus = Database["public"]["Enums"]["meeting_status"];
export type ClientStatus = Database["public"]["Enums"]["client_status"];

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type HistoryEvent = Database["public"]["Tables"]["history_events"]["Row"];
export type AppNotification = Database["public"]["Tables"]["notifications"]["Row"];

export type MeetingWithClient = Meeting & { client: Client | null };

export const SOURCE_LABEL: Record<LeadSource, string> = {
  live: "Live",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  trafego_pago: "Tráfego Pago",
  outro: "Outro",
};

export const SOURCES = Object.keys(SOURCE_LABEL) as LeadSource[];

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  reagendada: "Reagendada",
  realizada: "Realizada",
  nao_atendeu: "Não atendeu",
  cancelada: "Cancelada",
};

export const STATUSES = Object.keys(STATUS_LABEL) as MeetingStatus[];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  aguardando: "Aguardando contato",
  em_negociacao: "Em negociação",
  cliente: "Cliente",
  perdido: "Perdido",
};

/** Semantic tone per meeting status — maps to design tokens, never raw colours. */
export const STATUS_TONE: Record<MeetingStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  agendada: "neutral",
  confirmada: "accent",
  reagendada: "warning",
  realizada: "success",
  nao_atendeu: "warning",
  cancelada: "danger",
};

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export const REMINDERS = [
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "24 horas antes" },
];

/** Every reminder offset a meeting can carry, in minutes before the start. */
export const REMINDER_OFFSETS = [
  { value: 1440, label: "24 h antes", short: "24h" },
  { value: 120, label: "2 h antes", short: "2h" },
  { value: 60, label: "1 h antes", short: "1h" },
  { value: 30, label: "30 min antes", short: "30m" },
  { value: 15, label: "15 min antes", short: "15m" },
  { value: 5, label: "5 min antes", short: "5m" },
  { value: 0, label: "Na hora", short: "0" },
];

export const DEFAULT_OFFSETS = [1440, 60, 15, 0];

export const EVENT_LABEL: Record<string, string> = {
  client_created: "Cliente criado",
  client_updated: "Cliente atualizado",
  meeting_created: "Reunião marcada",
  meeting_rescheduled: "Reunião reagendada",
  meeting_status: "Status alterado",
  meeting_deleted: "Reunião removida",
  note: "Observação",
};
