import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { useAllMeetings } from "@/lib/data";
import { format, getMonth, getYear } from "date-fns";
import { L } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data: role, isLoading: roleLoading } = useMyRole();
  const { data: sdrs } = useAllSDRs();
  const { data: rules } = useBonusRules();
  const { data: meetings } = useAllMeetings();
  const qc = useQueryClient();

  const isAdmin = role === "admin";
  const now = new Date();
  const currentMonth = getMonth(now) + 1;
  const currentYear = getYear(now);

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["monthly_results"],
    queryFn: async () => {
      let q = supabase.from("monthly_results").select("*, profiles!monthly_results_user_id_fkey(full_name, display_name)").order("year", { ascending: false }).order("month", { ascending: false });
      if (!isAdmin) {
        const u = await supabase.auth.getUser();
        q = q.eq("user_id", u.data.user?.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!role
  });

  const fecharMesMutation = useMutation({
    mutationFn: async () => {
      if (!meetings || !sdrs || !rules) throw new Error("Dados não carregados");
      
      const thisMonth = meetings.filter((m) => getMonth(new Date(m.starts_at)) + 1 === currentMonth && getYear(new Date(m.starts_at)) === currentYear);
      const qualifiedThisMonth = thisMonth.filter((m) => (m as any).qualified === true);
      const sdrMap = new Map<string, number>();

      for (const m of qualifiedThisMonth) {
        sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
      }

      const activeSdrs = sdrs.filter((s) => s.active);
      
      for (const sdr of activeSdrs) {
        const count = sdrMap.get(sdr.user_id) ?? 0;
        const { bonus } = calculateBonus(count, rules);
        
        const { error } = await supabase.from("monthly_results").upsert({
          user_id: sdr.user_id,
          month: currentMonth,
          year: currentYear,
          qualified_meetings: count,
          bonus_amount: bonus,
          payment_status: "pendente",
          closed_at: new Date().toISOString()
        }, { onConflict: "user_id, month, year" });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mês fechado e resultados salvos com sucesso.");
      qc.invalidateQueries({ queryKey: ["monthly_results"] });
    },
    onError: (e: Error) => {
      toast.error("Erro ao fechar mês: " + e.message);
    }
  });

  const marcarPagoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_results").update({ payment_status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado para Pago.");
      qc.invalidateQueries({ queryKey: ["monthly_results"] });
    }
  });

  if (roleLoading || histLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico...</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Histórico de Bonificações</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe os fechamentos mensais passados.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => fecharMesMutation.mutate()} disabled={fecharMesMutation.isPending} className="bg-foreground text-background hover:bg-foreground/90">
            {fecharMesMutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Lock className="size-4 mr-2" />}
            Fechar Mês Atual
          </Button>
        )}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground">Período</th>
              {isAdmin && <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>}
              <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Bônus</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
              {isAdmin && <th className="py-3 px-4 font-medium text-muted-foreground w-24 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history?.map((row: any) => (
              <tr key={row.id} className="row-hover">
                <td className="py-3 px-4 font-medium">
                  {format(new Date(row.year, row.month - 1), "MMM/yyyy", L).toUpperCase()}
                </td>
                {isAdmin && (
                  <td className="py-3 px-4">
                    {row.profiles?.full_name || row.profiles?.display_name || "SDR"}
                  </td>
                )}
                <td className="py-3 px-4 tabular">
                  {row.qualified_meetings}
                </td>
                <td className="py-3 px-4 tabular font-medium text-success">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.bonus_amount)}
                </td>
                <td className="py-3 px-4">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", 
                    row.payment_status === "pago" ? "bg-success/10 text-success" : 
                    row.payment_status === "aprovado" ? "bg-accent/10 text-accent" : 
                    "bg-warning/10 text-warning-foreground"
                  )}>
                    {row.payment_status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="py-3 px-4 text-center">
                    {row.payment_status !== "pago" && (
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground hover:text-success" onClick={() => marcarPagoMutation.mutate(row.id)}>
                        <CheckCircle2 className="size-3 mr-1" /> Pagar
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {(!history || history.length === 0) && (
              <tr>
                <td colSpan={isAdmin ? 6 : 4} className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum fechamento registrado no histórico.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
