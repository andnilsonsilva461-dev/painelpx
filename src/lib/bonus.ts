import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BonusRule = {
  id: string;
  min_meetings: number;
  max_meetings: number | null;
  bonus_amount: number;
  active: boolean;
};

export type UserRole = {
  user_id: string;
  role: "admin" | "sdr";
  active: boolean;
  profiles: { full_name: string | null };
};

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? "sdr";
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBonusRules() {
  return useQuery({
    queryKey: ["bonus-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_rules")
        .select("*")
        .order("min_meetings");
      if (error) throw error;
      return data as BonusRule[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllSDRs() {
  return useQuery({
    queryKey: ["all-sdrs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          active,
          profiles ( full_name )
        `)
        .eq("role", "sdr");
      if (error) throw error;
      return data as unknown as UserRole[];
    },
  });
}

export function calculateBonus(qualifiedMeetings: number, rules: BonusRule[]) {
  const activeRules = rules.filter(r => r.active);
  if (!activeRules || activeRules.length === 0) return { bonus: 0, nextGoal: null, missing: 0, isMax: false };

  let bonus = 0;
  let nextGoal: number | null = null;

  const applicable = activeRules.find(
    (r) => qualifiedMeetings >= r.min_meetings && (r.max_meetings === null || qualifiedMeetings <= r.max_meetings)
  );

  if (applicable) bonus = applicable.bonus_amount;

  const nextRules = activeRules
    .filter((r) => r.min_meetings > qualifiedMeetings)
    .sort((a, b) => a.min_meetings - b.min_meetings);

  if (nextRules.length > 0) {
    nextGoal = nextRules[0].min_meetings;
  }

  return {
    bonus,
    nextGoal,
    missing: nextGoal ? nextGoal - qualifiedMeetings : 0,
    isMax: nextGoal === null,
  };
}

export function useToggleSDR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.from("user_roles" as any).update({ active }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-sdrs"] }),
  });
}

export function useMonthlyResults(filters?: { month?: number; year?: number; sdrId?: string }) {
  return useQuery({
    queryKey: ["monthly-results", filters],
    queryFn: async () => {
      let q = supabase.from("monthly_results" as any).select("*").order("year", { ascending: false }).order("month", { ascending: false });
      if (filters?.month !== undefined) q = q.eq("month", filters.month);
      if (filters?.year !== undefined) q = q.eq("year", filters.year);
      if (filters?.sdrId) q = q.eq("user_id", filters.sdrId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCloseMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, year, results }: { month: number, year: number, results: { userId: string, meetings: number, bonus: number }[] }) => {
      const payload = results.map(r => ({
        user_id: r.userId,
        month,
        year,
        qualified_meetings: r.meetings,
        bonus_amount: r.bonus,
        payment_status: "pendente"
      }));
      
      const { error } = await supabase.from("monthly_results" as any).upsert(payload, { onConflict: 'user_id, month, year' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-results"] }),
  });
}

export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pendente" | "aprovado" | "pago" }) => {
      const { error } = await supabase.from("monthly_results" as any).update({ payment_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-results"] }),
  });
}

export function useAddBonusRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<BonusRule, "id">) => {
      const { error } = await supabase.from("bonus_rules" as any).insert(rule);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-rules"] }),
  });
}

export function useUpdateBonusRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<BonusRule> }) => {
      const { error } = await supabase.from("bonus_rules" as any).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-rules"] }),
  });
}

export function useDeleteBonusRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bonus_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-rules"] }),
  });
}
