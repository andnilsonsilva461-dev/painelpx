import { useQuery } from "@tanstack/react-query";
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
        .eq("active", true)
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
        .eq("role", "sdr")
        .eq("active", true);
      if (error) throw error;
      return data as unknown as UserRole[];
    },
  });
}

export function calculateBonus(qualifiedMeetings: number, rules: BonusRule[]) {
  if (!rules || rules.length === 0) return { bonus: 0, nextGoal: null, missing: 0, isMax: false };

  let bonus = 0;
  let nextGoal: number | null = null;

  const applicable = rules.find(
    (r) => qualifiedMeetings >= r.min_meetings && (r.max_meetings === null || qualifiedMeetings <= r.max_meetings)
  );

  if (applicable) bonus = applicable.bonus_amount;

  const nextRules = rules
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
