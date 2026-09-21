import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Search, Plus, Filter, Target, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMyRole } from "@/lib/bonus";

export const Route = createFileRoute("/_authenticated/prospects")({
  component: ProspectsPage,
});

const STATUS_FUNNEL_OPTIONS = [
  "Novo", "Contatado", "Respondeu", "Em negociação", 
  "Reunião marcada", "Reunião realizada", "Proposta enviada", 
  "Fechado", "Perdido"
];

function ProspectsPage() {
  const qc = useQueryClient();
  const { data: role } = useMyRole();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sdrFilter, setSdrFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "", company: "", city: "", instagram: "", phone: "", 
    service: "", status_funnel: "Novo", notes: ""
  });

  const { data: user } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user
  });

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    const sub = supabase
      .channel("prospects_page_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        qc.invalidateQueries({ queryKey: ["prospects_list"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [qc]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        const { error } = await supabase.from("prospects").update(payload).eq("id", editingId);
        if (error) throw error;
        
        if (user && formData.status_funnel) {
          await supabase.from("history_events").insert({
            user_id: user.id,
            event_type: "atualizacao_prospect",
            description: `atualizou o prospect ${payload.name} para "${payload.status_funnel}".`
          });
        }
      } else {
        const { error } = await supabase.from("prospects").insert([payload]);
        if (error) throw error;

        if (user) {
          await supabase.from("history_events").insert({
            user_id: user.id,
            event_type: "novo_prospect",
            description: `cadastrou um novo prospect: ${payload.name}.`
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Prospect atualizado com sucesso!" : "Prospect criado com sucesso!");
      setIsModalOpen(false);
      qc.invalidateQueries({ queryKey: ["prospects_list"] });
    },
    onError: (err) => {
      toast.error("Erro ao salvar prospect");
      console.error(err);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prospect removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["prospects_list"] });
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nome é obrigatório");
    
    const payload = {
      ...formData,
      user_id: editingId ? undefined : user?.id,
    };
    saveMutation.mutate(payload);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ name: "", company: "", city: "", instagram: "", phone: "", service: "", status_funnel: "Novo", notes: "" });
    setIsModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || "", company: p.company || "", city: p.city || "", instagram: p.instagram || "",
      phone: p.phone || "", service: p.service || "", status_funnel: p.status_funnel || "Novo", notes: p.notes || ""
    });
    setIsModalOpen(true);
  };

  const updateStatusInline = async (id: string, newStatus: string, prospectName: string) => {
    const { error } = await supabase.from("prospects").update({ status_funnel: newStatus }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success("Status atualizado");
      if (user) {
        await supabase.from("history_events").insert({
          user_id: user.id,
          event_type: "atualizacao_prospect",
          description: `atualizou o prospect ${prospectName} para "${newStatus}".`
        });
      }
      qc.invalidateQueries({ queryKey: ["prospects_list"] });
    }
  };

  const filtered = useMemo(() => {
    let list = prospects || [];
    if (!isAdmin && user?.id) {
      list = list.filter(p => p.user_id === user.id);
    }

    return list.filter(p => {
      if (statusFilter !== "all" && p.status_funnel !== statusFilter) return false;
      if (sdrFilter !== "all" && p.user_id !== sdrFilter) return false;
      if (search) {
        const term = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(term) || 
          p.company?.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [prospects, isAdmin, user?.id, statusFilter, sdrFilter, search]);

  function getSdrName(userId: string) {
    return profiles?.find((p: any) => p.id === userId)?.full_name || "Membro";
  }

  const activeSdrs = useMemo(() => {
    const uniqueIds = Array.from(new Set((prospects || []).map(p => p.user_id)));
    return uniqueIds.map(id => ({ id, name: getSdrName(id) }));
  }, [prospects, profiles]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <Target className="size-5 text-accent" /> Acompanhamento de Prospects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe a jornada dos seus leads pelo funil de vendas.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-2" /> Novo Prospect</Button>
      </div>

      <div className="panel p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar nome ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div>
          <select 
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os status</option>
            {STATUS_FUNNEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div>
            <select 
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                <th className="px-4 py-3 font-medium text-muted-foreground">Nome / Empresa</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Contato</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Serviço / Cidade</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Data</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-muted-foreground">SDR</th>}
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum prospect encontrado.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="row-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.company || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{p.phone || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.instagram || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{p.service || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.city || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                       <select 
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-ring"
                        value={p.status_funnel || "Novo"}
                        onChange={(e) => updateStatusInline(p.id, e.target.value, p.name)}
                      >
                        {STATUS_FUNNEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular">
                      {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm">
                        {getSdrName(p.user_id)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(p)}>
                        <Edit2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { if(confirm("Deseja excluir este prospect?")) deleteMutation.mutate(p.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Prospect" : "Novo Prospect"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp / Telefone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Instagram / Site</Label>
                <Input value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Serviço de Interesse</Label>
                <Input value={formData.service} onChange={e => setFormData({...formData, service: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.status_funnel}
                  onChange={e => setFormData({...formData, status_funnel: e.target.value})}
                >
                  {STATUS_FUNNEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                rows={3} 
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
