import { createFileRoute } from "@tanstack/react-router";
import { useMyRole, useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { useAllMeetings } from "@/lib/data";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths, isSameMonth } from "date-fns";
import { L } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const { data: role } = useMyRole();
  const { data: sdrs } = useAllSDRs();
  const { data: meetings } = useAllMeetings();
  const { data: rules } = useBonusRules();
  const [monthsAgo, setMonthsAgo] = useState("0");

  const targetDate = subMonths(new Date(), parseInt(monthsAgo, 10));

  const ranking = useMemo(() => {
    const activeSdrs = (sdrs ?? []).filter(s => s.active);
    const list = meetings ?? [];
    
    const targetMeetings = list.filter(m => isSameMonth(new Date(m.starts_at), targetDate));
    const qualified = targetMeetings.filter(m => (m as any).qualified === true);

    const sdrMap = new Map<string, number>();
    for (const m of qualified) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }

    return activeSdrs.map(sdr => {
      const count = sdrMap.get(sdr.user_id) ?? 0;
      const { bonus, nextGoal, missing, isMax } = calculateBonus(count, rules ?? []);
      return {
        id: sdr.user_id,
        name: sdr.profiles.full_name || "Sem nome",
        count,
        bonus,
        nextGoal,
        missing,
        isMax
      };
    }).sort((a, b) => b.count - a.count);
  }, [sdrs, meetings, rules, targetDate]);

  if (role === "sdr") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-medium">Ranking da Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Desempenho de cada membro no período selecionado.</p>
        </motion.div>

        <div className="flex items-center gap-2">
          <Select value={monthsAgo} onValueChange={setMonthsAgo}>
            <SelectTrigger className="w-[200px] h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5, 6].map(m => {
                const d = subMonths(new Date(), m);
                return (
                  <SelectItem key={m} value={m.toString()}>
                    {format(d, "MMMM 'de' yyyy", L)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground w-16">Pos</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Bônus</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status da Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranking.map((sdr, index) => (
              <tr key={sdr.id} className="row-hover">
                <td className="py-3 px-4 font-medium">
                  <div className="flex items-center gap-2">
                    {index < 3 && <Trophy className={cn("size-4", index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : "text-amber-600")} />}
                    {index + 1}º
                  </div>
                </td>
                <td className="py-3 px-4 font-medium">{sdr.name}</td>
                <td className="py-3 px-4 tabular">
                  <span className="font-medium">{sdr.count}</span>
                </td>
                <td className="py-3 px-4 tabular font-medium text-success">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sdr.bonus)}
                </td>
                <td className="py-3 px-4">
                  {sdr.isMax ? (
                    <span className="text-xs font-medium text-accent">Faixa máxima atingida 🎉</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Faltam {sdr.missing} para {sdr.nextGoal}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {ranking.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Nenhum SDR listado no ranking.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
