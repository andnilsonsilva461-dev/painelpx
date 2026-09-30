import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

// Login gate disabled at the user's request: the app opens without signing in.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return { user: data.user ?? null };
    } catch {
      return { user: null };
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
