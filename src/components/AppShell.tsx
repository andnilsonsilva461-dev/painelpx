import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Users,
  BarChart3,
  PhoneCall,
  Plus,
  Search,
  Moon,
  Sun,
  Bell,
  LogOut,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MeetingDialog } from "@/components/MeetingDialog";
import { ReminderEngine } from "@/components/ReminderEngine";
import { supabase } from "@/integrations/supabase/client";
import { useAllMeetings, useClients, useNotifications, useRealtimeSync } from "@/lib/data";
import { relativeDayLabel, fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/agenda", label: "Minha agenda", icon: ListChecks },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/modo-ligacao", label: "Modo ligação", icon: PhoneCall },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useRealtimeSync();

  useEffect(() => {
    const stored = localStorage.getItem("orbit-theme") ?? "dark";
    setDark(stored === "dark");
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (!typing && e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("orbit-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <ReminderEngine />

      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            O
          </span>
          <span className="text-sm font-medium tracking-tight">Orbit</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
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
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4 opacity-60" /> Sair
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="focus-ring group flex h-8 max-w-[320px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-border-strong"
          >
            <Search className="size-3.5" />
            <span className="truncate">Buscar cliente, telefone, empresa…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1 font-mono text-[10px] sm:block">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <NotificationsButton />
            <Button variant="ghost" size="icon" className="size-8" onClick={toggleTheme} aria-label="Alternar tema">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button size="sm" className="h-8" onClick={() => setNewOpen(true)}>
              <Plus className="size-3.5" /> Nova reunião
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>

        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
          {NAV.slice(0, 5).map((item) => {
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
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: meetings } = useAllMeetings();

  const upcoming = useMemo(
    () => (meetings ?? []).filter((m) => new Date(m.starts_at) >= new Date()).slice(0, 6),
    [meetings],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar por nome, telefone, empresa ou Instagram…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Clientes">
          {(clients ?? []).slice(0, 40).map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.name} ${c.phone ?? ""} ${c.company ?? ""} ${c.instagram ?? ""} ${c.email ?? ""}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/clientes/$clientId", params: { clientId: c.id } });
              }}
            >
              <Users className="size-3.5 opacity-60" />
              <span>{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{c.company ?? c.phone ?? ""}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Próximas reuniões">
          {upcoming.map((m) => (
            <CommandItem
              key={m.id}
              value={`reuniao ${m.client?.name ?? m.title}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/agenda" });
              }}
            >
              <CalendarDays className="size-3.5 opacity-60" />
              <span>{m.client?.name ?? m.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {relativeDayLabel(m.starts_at)} · {fmtTime(m.starts_at)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function NotificationsButton() {
  const { data } = useNotifications();
  const unread = (data ?? []).filter((n) => !n.read_at);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label="Notificações">
          <Bell className="size-4" />
          {unread.length > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-border bg-popover p-0">
        <div className="border-b border-border px-3 py-2 text-eyebrow">Notificações</div>
        <div className="max-h-80 overflow-y-auto">
          {(data ?? []).length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nada por aqui ainda.</p>
          )}
          {(data ?? []).map((n) => (
            <div key={n.id} className="border-b border-border/60 px-3 py-2.5 last:border-0">
              <p className="text-[13px] leading-snug">{n.title}</p>
              {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
