import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ClientStatus, LeadSource } from "./domain";
import { DEFAULT_OFFSETS } from "./domain";

export type ProspectOutcome = Database["public"]["Enums"]["prospect_outcome"];
export type Prospect = Database["public"]["Tables"]["prospects"]["Row"];
export type LiveSession = Database["public"]["Tables"]["live_sessions"]["Row"];

export const OUTCOMES: {
  value: Exclude<ProspectOutcome, "pendente">;
  label: string;
  emoji: string;
  key: string;
  tone: "success" | "accent" | "warning" | "danger" | "neutral";
}[] = [
  { value: "agendou", label: "Agendou reunião", emoji: "✅", key: "a", tone: "success" },
  { value: "ligar_depois", label: "Ligar depois", emoji: "🔁", key: "r", tone: "accent" },
  { value: "nao_atendeu", label: "Não atendeu", emoji: "📞", key: "t", tone: "warning" },
  { value: "sem_interesse", label: "Não tem interesse", emoji: "❌", key: "n", tone: "danger" },
  { value: "vai_pensar", label: "Vai pensar", emoji: "🤔", key: "p", tone: "warning" },
  { value: "virou_cliente", label: "Virou cliente", emoji: "💰", key: "c", tone: "success" },
  { value: "numero_errado", label: "Número errado", emoji: "⛔", key: "e", tone: "neutral" },
  { value: "sem_whatsapp", label: "Sem WhatsApp", emoji: "📵", key: "w", tone: "neutral" },
];

export const OUTCOME_LABEL: Record<ProspectOutcome, string> = {
  pendente: "Pendente",
  agendou: "Agendou reunião",
  ligar_depois: "Ligar depois",
  nao_atendeu: "Não atendeu",
  sem_interesse: "Sem interesse",
  vai_pensar: "Vai pensar",
  virou_cliente: "Virou cliente",
  numero_errado: "Número errado",
  sem_whatsapp: "Sem WhatsApp",
};

export const OUTCOME_EMOJI: Record<ProspectOutcome, string> = {
  pendente: "•",
  agendou: "✅",
  ligar_depois: "🔁",
  nao_atendeu: "📞",
  sem_interesse: "❌",
  vai_pensar: "🤔",
  virou_cliente: "💰",
  numero_errado: "⛔",
  sem_whatsapp: "📵",
};

const CLIENT_STATUS_FOR: Record<ProspectOutcome, ClientStatus> = {
  pendente: "aguardando",
  agendou: "em_negociacao",
  ligar_depois: "aguardando",
  nao_atendeu: "aguardando",
  sem_interesse: "perdido",
  vai_pensar: "em_negociacao",
  virou_cliente: "cliente",
  numero_errado: "perdido",
  sem_whatsapp: "aguardando",
};

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada");
  return data.user.id;
}

/* ---------------------------------- reads --------------------------------- */

export function useProspects() {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: async (): Promise<Prospect[]> => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLiveSessions() {
  return useQuery({
    queryKey: ["live-sessions"],
    queryFn: async (): Promise<LiveSession[]> => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Realtime: prospects + sessions keep the live counters in sync across devices. */
export function useProspectRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("orbit-prospects")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        qc.invalidateQueries({ queryKey: ["prospects"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["live-sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/* --------------------------------- sessions -------------------------------- */

export function useStartLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: number) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("live_sessions")
        .insert({ user_id, goal, title: `Live ${new Date().toLocaleDateString("pt-BR")}` })
        .select("*")
        .single();
      if (error) throw error;
      return data as LiveSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-sessions"] }),
  });
}

export function useEndLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("live_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-sessions"] }),
  });
}

export function useUpdateLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LiveSession> }) => {
      const { error } = await supabase.from("live_sessions").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-sessions"] }),
  });
}

/* -------------------------------- prospects -------------------------------- */

export type ProspectDraft = {
  name: string;
  phone?: string | null;
  instagram?: string | null;
  company?: string | null;
  notes?: string | null;
  source?: LeadSource;
  outcome: Exclude<ProspectOutcome, "pendente">;
  sessionId?: string | null;
  /** Meeting date when outcome = agendou. */
  meetingAt?: Date | null;
  durationMinutes?: number;
  /** Callback date when outcome = ligar_depois. */
  callbackAt?: Date | null;
};

/** One click = lead + client record + (optional) meeting, all wired together. */
export function useSaveProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ProspectDraft) => {
      const user_id = await currentUserId();
      const source = draft.source ?? "live";
      const name = draft.name.trim();

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id,
          name,
          phone: draft.phone?.trim() || null,
          instagram: draft.instagram?.trim() || null,
          company: draft.company?.trim() || null,
          notes: draft.notes?.trim() || null,
          source,
          status: CLIENT_STATUS_FOR[draft.outcome],
        })
        .select("id")
        .single();
      if (clientError) throw clientError;

      let meetingId: string | null = null;
      if (draft.outcome === "agendou" && draft.meetingAt) {
        const { data: meeting, error: meetingError } = await supabase
          .from("meetings")
          .insert({
            user_id,
            client_id: client.id,
            title: name,
            starts_at: draft.meetingAt.toISOString(),
            duration_minutes: draft.durationMinutes ?? 30,
            status: "agendada",
            source,
            notes: draft.notes?.trim() || null,
            reminder_minutes: 15,
            reminder_offsets: DEFAULT_OFFSETS,
          })
          .select("id")
          .single();
        if (meetingError) throw meetingError;
        meetingId = meeting.id;
      }

      const { data: prospect, error } = await supabase
        .from("prospects")
        .insert({
          user_id,
          session_id: draft.sessionId ?? null,
          client_id: client.id,
          meeting_id: meetingId,
          name,
          phone: draft.phone?.trim() || null,
          instagram: draft.instagram?.trim() || null,
          company: draft.company?.trim() || null,
          notes: draft.notes?.trim() || null,
          source,
          outcome: draft.outcome,
          callback_at: draft.callbackAt ? draft.callbackAt.toISOString() : null,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("history_events").insert({
        user_id,
        client_id: client.id,
        meeting_id: meetingId,
        event_type: "client_created",
        description: `Prospecção ao vivo · ${OUTCOME_LABEL[draft.outcome]}`,
      });

      if (draft.outcome === "ligar_depois" && draft.callbackAt) {
        await supabase.from("notifications").insert({
          user_id,
          title: `Retornar para ${name}`,
          message: draft.notes?.trim() || draft.phone || null,
          fire_at: draft.callbackAt.toISOString(),
        });
      }

      return prospect as Prospect;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useUpdateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Prospect> }) => {
      const { data, error } = await supabase.from("prospects").update(values).eq("id", id).select("*").single();
      if (error) throw error;
      const row = data as Prospect;
      if (row.client_id && values.outcome) {
        await supabase
          .from("clients")
          .update({ status: CLIENT_STATUS_FOR[values.outcome] })
          .eq("id", row.client_id);
      }
      if (row.client_id) {
        const patch: Record<string, unknown> = {};
        if (values.name) patch.name = values.name;
        if ("phone" in values) patch.phone = values.phone ?? null;
        if ("company" in values) patch.company = values.company ?? null;
        if ("notes" in values) patch.notes = values.notes ?? null;
        if (Object.keys(patch).length) await supabase.from("clients").update(patch).eq("id", row.client_id);
      }
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });
}

/* ---------------------------------- stats ---------------------------------- */

export function summarize(rows: Prospect[]) {
  const count = (o: ProspectOutcome) => rows.filter((r) => r.outcome === o).length;
  const total = rows.length;
  const meetings = count("agendou");
  const clients = count("virou_cliente");
  const rejected = count("sem_interesse") + count("numero_errado");
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    meetings,
    clients,
    callbacks: count("ligar_depois"),
    noAnswer: count("nao_atendeu"),
    thinking: count("vai_pensar"),
    rejected,
    scheduleRate: pct(meetings),
    conversionRate: pct(clients),
    rejectionRate: pct(rejected),
  };
}
