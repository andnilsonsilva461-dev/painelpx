import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Client, Meeting, MeetingWithClient, MeetingStatus } from "./domain";

const MEETING_SELECT = "*, client:clients(*)";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
}

export function useMeetings(range?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ["meetings", range?.from.toISOString() ?? "all", range?.to.toISOString() ?? "all"],
    queryFn: async () => {
      let q = supabase.from("meetings").select(MEETING_SELECT).order("starts_at");
      if (range) q = q.gte("starts_at", range.from.toISOString()).lt("starts_at", range.to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MeetingWithClient[];
    },
  });
}

export function useAllMeetings() {
  return useQuery({
    queryKey: ["meetings", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(MEETING_SELECT)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MeetingWithClient[];
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });
}

export function useClientMeetings(clientId: string) {
  return useQuery({
    queryKey: ["meetings", "client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(MEETING_SELECT)
        .eq("client_id", clientId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MeetingWithClient[];
    },
  });
}

export function useTimeline(clientId: string) {
  return useQuery({
    queryKey: ["timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("history_events")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("fire_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada");
  return data.user.id;
}

async function logEvent(input: {
  clientId: string | null;
  meetingId?: string | null;
  type: string;
  description?: string;
}) {
  const userId = await currentUserId();
  await supabase.from("history_events").insert({
    user_id: userId,
    client_id: input.clientId,
    meeting_id: input.meetingId ?? null,
    event_type: input.type,
    description: input.description ?? null,
  });
}

export type MeetingDraft = {
  id?: string;
  clientName: string;
  phone?: string | null;
  company?: string | null;
  instagram?: string | null;
  email?: string | null;
  clientId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  source: Meeting["source"];
  status: MeetingStatus;
  notes?: string | null;
  reminderMinutes: number;
};

export function useSaveMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: MeetingDraft) => {
      const userId = await currentUserId();
      let clientId = draft.clientId ?? null;

      if (clientId) {
        await supabase
          .from("clients")
          .update({
            name: draft.clientName,
            phone: draft.phone ?? null,
            company: draft.company ?? null,
            instagram: draft.instagram ?? null,
            email: draft.email ?? null,
            source: draft.source,
          })
          .eq("id", clientId);
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            user_id: userId,
            name: draft.clientName,
            phone: draft.phone ?? null,
            company: draft.company ?? null,
            instagram: draft.instagram ?? null,
            email: draft.email ?? null,
            source: draft.source,
          })
          .select("id")
          .single();
        if (error) throw error;
        clientId = data.id;
        await logEvent({ clientId, type: "client_created", description: draft.clientName });
      }

      const payload = {
        user_id: userId,
        client_id: clientId,
        title: draft.clientName,
        starts_at: draft.startsAt.toISOString(),
        duration_minutes: draft.durationMinutes,
        status: draft.status,
        source: draft.source,
        notes: draft.notes ?? null,
        reminder_minutes: draft.reminderMinutes,
        reminder_fired: false,
      };

      if (draft.id) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", draft.id);
        if (error) throw error;
        await logEvent({ clientId, meetingId: draft.id, type: "meeting_status", description: "Reunião atualizada" });
        return draft.id;
      }

      const { data, error } = await supabase.from("meetings").insert(payload).select("id").single();
      if (error) throw error;
      await logEvent({
        clientId,
        meetingId: data.id,
        type: "meeting_created",
        description: draft.startsAt.toLocaleString("pt-BR"),
      });
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useRescheduleMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meeting, newDate }: { meeting: MeetingWithClient; newDate: Date }) => {
      const { error } = await supabase
        .from("meetings")
        .update({ starts_at: newDate.toISOString(), status: "reagendada", reminder_fired: false })
        .eq("id", meeting.id);
      if (error) throw error;
      await logEvent({
        clientId: meeting.client_id,
        meetingId: meeting.id,
        type: "meeting_rescheduled",
        description: `${new Date(meeting.starts_at).toLocaleString("pt-BR")} → ${newDate.toLocaleString("pt-BR")}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useUpdateMeetingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meeting, status }: { meeting: MeetingWithClient; status: MeetingStatus }) => {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", meeting.id);
      if (error) throw error;
      await logEvent({
        clientId: meeting.client_id,
        meetingId: meeting.id,
        type: "meeting_status",
        description: status,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meeting: MeetingWithClient) => {
      const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
      if (error) throw error;
      await logEvent({ clientId: meeting.client_id, type: "meeting_deleted" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Client> }) => {
      const { error } = await supabase.from("clients").update(values).eq("id", id);
      if (error) throw error;
      await logEvent({ clientId: id, type: "client_updated" });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["timeline", v.id] });
    },
  });
}

/** Live sync: any change to meetings/notifications refreshes the cache. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("orbit-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => {
        qc.invalidateQueries({ queryKey: ["meetings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
