import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Shield, Check, X, Plus, Trash2 } from "lucide-react";
import { useMyRole, useBonusRules, useAllSDRs, calculateBonus, useCloseMonth, useAddBonusRule, useDeleteBonusRule } from "@/lib/bonus";
import { useAllMeetings } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { data: role, isLoading: roleLoading } = useMyRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState("validacao");

  useEffect(() => {
    if (!roleLoading && role !== "admin") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [role, roleLoading, navigate]);

  if (roleLoading || role !== "admin") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando painel de administrador...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <Shield className="size-6 text-accent" /> Painel do Administrador
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Valide reuniões, feche o mês e gerencie as regras de bonificação.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border pb-px">
        {[
          { id: "validacao", label: "Validação" },
          { id: "fechamento", label: "Fechamento" },
          { id: "regras", label: "Regras de Bônus" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "validacao" && <ValidacaoTab />}
        {tab === "fechamento" && <FechamentoTab />}
        {tab === "regras" && <RegrasTab />}
      </div>
    </div>
  );
}

function ValidacaoTab() {
  const { data: meetings } = useAllMeetings();
  const { data: sdrs } = useAllSDRs();
  const qc = useQueryClient();
  
  const updateQualified = useMutation({
    mutationFn: async ({ id, qualified }: { id: string; qualified: boolean }) => {
      const { error } = await supabase.from("meetings").update({ qualified }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Reunião atualizada com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar reunião")
  });

  const allRealizadas = useMemo(() => {
    return (meetings ?? [])
      .filter(m => m.status === "realizada")
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
      .slice(0, 100);
  }, [meetings]);

  function getSdrName(userId: string) {
    const sdr = (sdrs ?? []).find(s => s.user_id === userId);
    return sdr?.profiles?.full_name || "Desconhecido";
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section>
        <h2 className="text-lg font-medium mb-4">Validação de Reuniões Realizadas</h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">SDR</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allRealizadas.map(m => (
                <tr key={m.id} className="row-hover">
                  <td className="px-4 py-3">{format(new Date(m.starts_at), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-4 py-3">{m.client?.name ?? m.title}</td>
                  <td className="px-4 py-3">{getSdrName(m.user_id)}</td>
                  <td className="px-4 py-3 text-center">
                    {(m as any).qualified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                        <Check className="size-3" /> Válida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border">
                        Pendente / Inválida
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={(m as any).qualified === true}
                        className="h-7 text-xs bg-success/10 text-success border-success/20 hover:bg-success/20 disabled:opacity-50" 
                        onClick={() => updateQualified.mutate({ id: m.id, qualified: true })}
                      >
                        <Check className="size-3.5 mr-1" /> Validar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={(m as any).qualified === false}
                        className="h-7 text-xs bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 disabled:opacity-50" 
                        onClick={() => updateQualified.mutate({ id: m.id, qualified: false })}
                      >
                        <X className="size-3.5 mr-1" /> Invalidar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {allRealizadas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma reunião realizada encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FechamentoTab() {
  const { data: sdrs } = useAllSDRs();
  const { data: meetings } = useAllMeetings();
  const { data: rules } = useBonusRules();
  const closeMonth = useCloseMonth();
  
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const results = useMemo(() => {
    const list = meetings ?? [];
    const activeSdrs = (sdrs ?? []).filter(s => s.active);
    const sdrMap = new Map<string, number>();
    
    const monthMeetings = list.filter(m => {
      const d = new Date(m.starts_at);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const qualifiedMonth = monthMeetings.filter(m => (m as any).qualified === true);
    
    for (const m of qualifiedMonth) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }
    
    return activeSdrs.map(sdr => {
      const count = sdrMap.get(sdr.user_id) ?? 0;
      const { bonus } = calculateBonus(count, rules ?? []);
      return { userId: sdr.user_id, name: sdr.profiles?.full_name || "Desconhecido", meetings: count, bonus };
    });
  }, [meetings, sdrs, rules, month, year]);

  async function handleClose() {
    if (!confirm(`Confirmar fechamento do mês ${month}/${year}?`)) return;
    try {
      await closeMonth.mutateAsync({ month, year, results });
      toast.success("Mês fechado com sucesso!");
    } catch (e) {
      toast.error("Erro ao fechar mês");
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="panel p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Mês</label>
          <select className="h-9 w-32 rounded-md border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Ano</label>
          <select className="h-9 w-32 rounded-md border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleClose} disabled={closeMonth.isPending} className="ml-auto">
          Fechar Mês
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">SDR</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Reuniões Qualificadas</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Bônus Calculado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map(r => (
              <tr key={r.userId} className="row-hover">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 tabular">{r.meetings}</td>
                <td className="px-4 py-3 text-success font-medium tabular">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.bonus)}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado para exibir.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RegrasTab() {
  const { data: rules } = useBonusRules();
  const addRule = useAddBonusRule();
  const deleteRule = useDeleteBonusRule();

  const [minMeetings, setMin] = useState("");
  const [bonus, setBonus] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const min = Number(minMeetings);
    const val = Number(bonus);
    if (!min || !val) return toast.error("Preencha os campos corretamente");
    try {
      await addRule.mutateAsync({ min_meetings: min, max_meetings: null, bonus_amount: val, active: true });
      setMin("");
      setBonus("");
      toast.success("Regra adicionada");
    } catch {
      toast.error("Erro ao adicionar regra");
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <form onSubmit={handleAdd} className="panel p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Mínimo de Reuniões</label>
          <Input type="number" required min={1} value={minMeetings} onChange={e => setMin(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Valor do Bônus (R$)</label>
          <Input type="number" required min={1} value={bonus} onChange={e => setBonus(e.target.value)} className="w-40" />
        </div>
        <Button type="submit" disabled={addRule.isPending}>
          <Plus className="size-4 mr-1.5" /> Adicionar
        </Button>
      </form>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">Mínimo de Reuniões</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Valor do Bônus</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(rules ?? []).map(r => (
              <tr key={r.id} className="row-hover">
                <td className="px-4 py-3 tabular">{r.min_meetings} reuniões</td>
                <td className="px-4 py-3 text-success font-medium tabular">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.bonus_amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteRule.mutate(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {(!rules || rules.length === 0) && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhuma regra definida.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
