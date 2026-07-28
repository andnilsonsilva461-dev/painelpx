import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_OFFSETS } from "./domain";

export type Device = {
  id: string;
  endpoint: string;
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
};

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async (): Promise<Device[]> => {
      const { data, error } = await supabase
        .from("device_subscriptions")
        .select("id, endpoint, device_name, platform, browser, user_agent, last_seen_at, created_at")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type UserSettings = {
  user_id: string;
  default_reminder_offsets: number[];
  daily_digest: boolean;
  daily_digest_hour: number;
  timezone: string;
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<UserSettings | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;

      const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
      if (data) return data as UserSettings;

      const fallback = {
        user_id: userId,
        default_reminder_offsets: DEFAULT_OFFSETS,
        daily_digest: true,
        daily_digest_hour: 8,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      };
      const { data: created } = await supabase
        .from("user_settings")
        .upsert(fallback, { onConflict: "user_id" })
        .select("*")
        .maybeSingle();
      return (created as UserSettings) ?? fallback;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<UserSettings, "user_id">>) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
