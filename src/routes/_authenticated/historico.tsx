import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/bonus";
import { format } from "date-fns";
import { L } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data: role } = useMyRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const { data: results, isLoading } = useQuery({
    queryKey: ["monthly_results"],
    queryFn: async () => {
      const q = supabase.from("monthly_results").select(`
        *,
        profiles:user_id(full_name)
      `).order("year", { ascending: false }).order("month", { ascending: false });
      
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    }
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_results").update({ payment_status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly_results"] })
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico...</div>;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-medium mb-6">Histórico de Bonificações</h1>
      
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 font-medium text-muted-foreground">Mês/Ano</th>
                {isAdmin && <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>}
                <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Bônus</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
                {isAdmin && <th className="py-3 px-4 font-medium text-muted-foreground text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results?.map((row) => (
                <tr key={row.id} className="row-hover">
                  <td className="py-3 px-4 font-medium">
                    {format(new Date(row.year, row.month - 1), "MMM/yyyy", L).toUpperCase()}
                  </td>
                  {isAdmin && <td className="py-3 px-4">{row.profiles?.full_name || "Desconhecido"}</td>}
                  <td className="py-3 px-4 tabular">{row.qualified_meetings}</td>
                  <td className="py-3 px-4 tabular text-success font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.bonus_amount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                      row.payment_status === "pago" 
                        ? "border-success/30 bg-success/10 text-success" 
                        : "border-warning/30 bg-warning/10 text-warning"
                    }`}>
                      {row.payment_status === "pago" ? <CheckCircle2 className="size-3" /> : <CircleDashed className="size-3" />}
                      {row.payment_status.toUpperCase()}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      {row.payment_status !== "pago" && (
                        <button 
                          onClick={() => payMutation.mutate(row.id)}
                          disabled={payMutation.isPending}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          Marcar como pago
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {(!results || results.length === 0) && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 4} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum registro encontrado no histórico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
