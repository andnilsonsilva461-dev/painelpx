import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Moon,
  Sun,
  LogOut,
  Gift,
  Trophy,
  Settings,
  History,
  Plus,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/MeetingDialog";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRole } from "@/lib/bonus";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Reuniões", icon: ListChecks },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/bonificacao", label: "Bonificações", icon: Gift },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const { data: role } = useMyRole();

  useRealtimeSync();

  useEffect(() => {
    const stored = localStorage.getItem("pixel-theme") ?? "dark";
    setDark(stored === "dark");
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pixel-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const activeNav = NAV.filter((item) => {
    if (role === "sdr") {
      return ["Reuniões", "Bonificações", "Histórico"].includes(item.label);
    }
    return true;
  });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="grid size-7 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
            PX
          </span>
          <span className="text-sm font-semibold tracking-wide">PIXEL GRAPHICS</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {activeNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("size-4", active ? "opacity-100" : "opacity-60")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4 opacity-60" /> Sair
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8" onClick={toggleTheme} aria-label="Alternar tema">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button size="sm" className="h-8 ml-2" onClick={() => setNewOpen(true)}>
              <Plus className="size-3.5 mr-1.5" /> Registrar Reunião
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          {children}
        </main>

        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
          {activeNav.slice(0, 5).map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[10px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={() => setNewOpen(true)}
        aria-label="Nova reunião"
        className="focus-ring fixed bottom-20 right-5 z-40 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-panel)] transition-transform duration-200 hover:scale-105 active:scale-95 lg:hidden"
      >
        <Plus className="size-5" />
      </button>

      <MeetingDialog open={newOpen} onOpenChange={setNewOpen} compact />
    </div>
  );
}
