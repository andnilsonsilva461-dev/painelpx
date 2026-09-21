import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Search, Plus, ListChecks, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyRole } from "@/lib/bonus";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { MeetingDialog } from "@/components/MeetingDialog";

export const Route = createFileRoute("/_authenticated/reunioes")({
  component: ReunioesPage,
});

const MEETING_STATUS = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "realizada", label: "Realizada" },
  { value: "nao_atendeu", label: "Não compareceu" },
  { value: "cancelada", label: "Cancelada" },
  { value: "reagendada", label: "Reagendada" },
];

function ReunioesPage() {
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sdrFilter, setSdrFilter] = useState("all");
  const [qualFilter, setQualFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings_list_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          client:clients(name, company, phone)
        `)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    const sub = supabase
      .channel("reunioes_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => {
        qc.invalidateQueries({ queryKey: ["meetings_list_full"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [qc]);

  const updateMeeting = useMutation({
    mutationFn: async ({ id, values, prospectName }: { id: string; values: any; prospectName: string }) => {
      const { error } = await supabase.from("meetings").update(values).eq("id", id);
      if (error) throw error;
      
      if (user && values.status) {
         const statusLabel = MEETING_STATUS.find(s => s.value === values.status)?.label || values.status;
         await supabase.from("history_events").insert({
            user_id: user.id,
            event_type: "atualizacao_reuniao",
            description: `atualizou a reunião com ${prospectName} para "${statusLabel}".`
          });
      }
    },
    onSuccess: () => {
      toast.success("Reunião atualizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["meetings_list_full"] });
    },
    onError: () => toast.error("Erro ao atualizar reunião")
  });

  function getSdrName(userId: string) {
    return profiles?.find((p: any) => p.id === userId)?.full_name || "Membro";
  }

  const activeSdrs = useMemo(() => {
    const uniqueIds = Array.from(new Set((meetings || []).map(m => m.user_id)));
    return uniqueIds.map(id => ({ id, name: getSdrName(id) }));
  }, [meetings, profiles]);

  const filtered = useMemo(() => {
    let list = meetings || [];
    if (!isAdmin && user?.id) {
      list = list.filter(m => m.user_id === user.id);
    }

    return list.filter(m => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (sdrFilter !== "all" && m.user_id !== sdrFilter) return false;
      if (qualFilter !== "all") {
        const isQual = (m as any).qualified === true;
        if (qualFilter === "yes" && !isQual) return false;
        if (qualFilter === "no" && isQual) return false;
      }
      if (dateFilter) {
        const md = format(new Date(m.starts_at), "yyyy-MM-dd");
        if (md !== dateFilter) return false;
      }
      if (search) {
        const term = search.toLowerCase();
        const clientName = (m.client as any)?.name?.toLowerCase() || "";
        const clientCompany = (m.client as any)?.company?.toLowerCase() || "";
        if (!clientName.includes(term) && !clientCompany.includes(term)) return false;
      }
      return true;
    });
  }, [meetings, isAdmin, user?.id, statusFilter, sdrFilter, qualFilter, dateFilter, search]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <ListChecks className="size-5 text-accent" /> Reuniões da Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe todas as reuniões, gerencie os status e qualificações.
          </p>
        </div>
        <Button onClick={() => setNewMeetingOpen(true)}><Plus className="size-4 mr-2" /> Nova Reunião</Button>
      </div>

      <div className="panel p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar cliente/empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div>
          <Input 
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="text-muted-foreground w-full"
          />
        </div>
        <div>
          <select 
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os status</option>
            {MEETING_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <select 
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            value={qualFilter}
            onChange={e => setQualFilter(e.target.value)}
          >
            <option value="all">Qualificada: Todas</option>
            <option value="yes">Sim (Aprovada)</option>
            <option value="no">Não / Pendente</option>
          </select>
        </div>
        {isAdmin && (
          <div>
            <select 
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={sdrFilter}
              onChange={e => setSdrFilter(e.target.value)}
            >
              <option value="all">Todos os SDRs</option>
              {activeSdrs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Data e Hora</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Prospect / Empresa</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Telefone / Serviço</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-muted-foreground">SDR</th>}
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Qualificada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma reunião encontrada.</td></tr>
              ) : (
                filtered.map(m => {
                  const prospectName = (m.client as any)?.name || m.title || "Cliente";
                  const company = (m.client as any)?.company || "—";
                  const phone = (m.client as any)?.phone || "—";
                  
                  return (
                    <tr key={m.id} className="row-hover">
                      <td className="px-4 py-3">
                        <p className="font-medium">{format(new Date(m.starts_at), "dd/MM/yyyy")}</p>
                        <p className="text-xs text-muted-foreground tabular">{format(new Date(m.starts_at), "HH:mm")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{prospectName}</p>
                        <p className="text-xs text-muted-foreground">{company}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm tabular">{phone}</p>
                        <p className="text-xs text-muted-foreground">{m.service || "—"}</p>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-sm">
                          {getSdrName(m.user_id)}
                        </td>
                      )}
                      <td className="px-4 py-3">
                         <select 
                          className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-ring"
                          value={m.status}
                          onChange={(e) => updateMeeting.mutate({ id: m.id, values: { status: e.target.value }, prospectName })}
                        >
                          {MEETING_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(m as any).qualified ? (
                           <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                            <Check className="size-3" /> Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border">
                            Não
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MeetingDialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen} compact />
    </div>
  );
}
