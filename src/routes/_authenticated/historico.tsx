import { createFileRoute } from "@tanstack/react-router";
import { useMyRole, useAllSDRs, useMonthlyResults, useCloseMonth, useUpdatePaymentStatus, useBonusRules, calculateBonus } from "@/lib/bonus";
import { useAllMeetings, useSession } from "@/lib/data";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, isSameMonth } from "date-fns";
import { L } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data: role } = useMyRole();
  const { data: sdrs } = useAllSDRs();
  const { data: meetings } = useAllMeetings();
  const { data: rules } = useBonusRules();
  const { data: results } = useMonthlyResults();
  const { data: user } = useSession();
  const closeMonth = useCloseMonth();
  const updateStatus = useUpdatePaymentStatus();

  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterSdr, setFilterSdr] = useState<string>("all");

  const isAdmin = role === "admin";

  const rows = useMemo(() => {
    let list = results ?? [];
    if (!isAdmin) {
      list = list.filter(r => r.user_id === user?.id);
    } else {
      if (filterSdr !== "all") list = list.filter(r => r.user_id === filterSdr);
      if (filterMonth !== "all") {
        const [m, y] = filterMonth.split("-");
        list = list.filter(r => r.month === Number(m) && r.year === Number(y));
      }
    }
    return list.map(r => {
      const sdr = sdrs?.find(s => s.user_id === r.user_id);
      return {
        ...r,
        sdrName: sdr?.profiles?.full_name || "SDR",
      };
    });
  }, [results, sdrs, isAdmin, filterSdr, filterMonth, user]);

  async function handleCloseMonth() {
    if (!confirm("Tem certeza que deseja fechar o mês atual? Isso irá congelar e registrar o bônus final de todos os SDRs para o mês vigente.")) return;
    
    const now = new Date();
    const activeSdrs = (sdrs ?? []).filter(s => s.active);
    const thisMonthMeetings = (meetings ?? []).filter(m => isSameMonth(new Date(m.starts_at), now));
    const qualified = thisMonthMeetings.filter(m => (m as any).qualified === true);

    const sdrMap = new Map<string, number>();
    for (const m of qualified) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }

    const payload = activeSdrs.map(sdr => {
      const count = sdrMap.get(sdr.user_id) ?? 0;
      const { bonus } = calculateBonus(count, rules ?? []);
      return {
        userId: sdr.user_id,
        meetings: count,
        bonus
      };
    });

    try {
      await closeMonth.mutateAsync({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        results: payload
      });
      toast.success("Mês fechado com sucesso!");
    } catch (e) {
      toast.error("Erro ao fechar o mês. Verifique sua conexão.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-medium">Histórico de Bonificações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resultados e pagamentos dos meses anteriores.</p>
        </motion.div>

        {isAdmin && (
          <Button onClick={handleCloseMonth} className="h-9 gap-2" disabled={closeMonth.isPending}>
            <Lock className="size-3.5" /> Fechar Mês Atual
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[180px] h-9 text-[13px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {Array.from(new Set((results ?? []).map(r => `${r.month}-${r.year}`))).map(my => {
                const [m, y] = my.split("-");
                return (
                  <SelectItem key={my} value={my}>
                    {format(new Date(Number(y), Number(m) - 1), "MMMM 'de' yyyy", L)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={filterSdr} onValueChange={setFilterSdr}>
            <SelectTrigger className="w-[200px] h-9 text-[13px]">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {sdrs?.map(s => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.profiles.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-6 panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground">Mês</th>
              {isAdmin && <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>}
              <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Bônus</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="row-hover">
                <td className="py-3 px-4 capitalize">
                  {format(new Date(row.year, row.month - 1), "MMMM / yyyy", L)}
                </td>
                {isAdmin && <td className="py-3 px-4 font-medium">{row.sdrName}</td>}
                <td className="py-3 px-4 tabular">
                  {row.qualified_meetings} reuniões
                </td>
                <td className="py-3 px-4 tabular font-medium text-success">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.bonus_amount)}
                </td>
                <td className="py-3 px-4">
                  {isAdmin ? (
                    <Select
                      value={row.payment_status}
                      onValueChange={(val: any) => updateStatus.mutate({ id: row.id, status: val })}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                      row.payment_status === "pago" ? "bg-success/10 text-success border-success/20" :
                      row.payment_status === "aprovado" ? "bg-accent/10 text-accent border-accent/20" :
                      "bg-warning/10 text-warning border-warning/20"
                    )}>
                      {row.payment_status === "pago" ? "Pago" : row.payment_status === "aprovado" ? "Aprovado" : "Pendente"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum histórico de fechamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
