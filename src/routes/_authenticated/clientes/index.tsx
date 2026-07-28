import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useClients } from "@/lib/data";
import { CLIENT_STATUS_LABEL, LEAD_SOURCE_LABEL, type ClientStatus } from "@/lib/domain";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Orbit" },
      { name: "description", content: "Base de leads de prospecção com origem, status e histórico de contato." },
      { property: "og:title", content: "Clientes — Orbit" },
      { property: "og:description", content: "Base de leads de prospecção comercial." },
    ],
  }),
  component: ClientsPage,
});

const FILTERS: (ClientStatus | "todos")[] = ["todos", "aguardando", "agendado", "cliente", "perdido"];

function ClientsPage() {
  const { data: clients } = useClients();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("todos");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (clients ?? []).filter((c) => {
      if (filter !== "todos" && c.status !== filter) return false;
      if (!term) return true;
      return [c.name, c.company, c.phone, c.instagram]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [clients, q, filter]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-2xl font-medium">Clientes</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, empresa, telefone…"
            maxLength={120}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2.5 py-1 text-xs capitalize transition-colors duration-150",
                filter === f ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "todos" ? "Todos" : CLIENT_STATUS_LABEL[f as ClientStatus]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel mt-5 overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 px-4 py-2.5 text-[11px] text-muted-foreground hairline md:grid">
          <span>Nome</span>
          <span>Empresa</span>
          <span>Contato</span>
          <span>Origem</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((c) => (
            <Link
              key={c.id}
              to="/clientes/$clientId"
              params={{ clientId: c.id }}
              className="row-hover grid grid-cols-1 gap-1 px-4 py-3 text-[13px] md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.7fr] md:gap-3"
            >
              <span className="truncate">{c.name}</span>
              <span className="truncate text-muted-foreground">{c.company ?? "—"}</span>
              <span className="tabular truncate text-muted-foreground">{c.phone ?? c.instagram ?? "—"}</span>
              <span className="truncate text-muted-foreground">
                {c.source ? LEAD_SOURCE_LABEL[c.source] : "—"}
              </span>
              <span className="text-muted-foreground">
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px]">
                  {CLIENT_STATUS_LABEL[c.status]}
                </span>
              </span>
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Users className="size-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {rows.length} {rows.length === 1 ? "cliente" : "clientes"}
      </p>
    </div>
  );
}
