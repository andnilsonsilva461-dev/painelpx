import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useAllMeetings } from "@/lib/data";
import { useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { isSameMonth } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const { data: meetings } = useAllMeetings();
  const { data: sdrs } = useAllSDRs();
  const { data: rules } = useBonusRules();
  const now = new Date();

  const ranking = useMemo(() => {
    const list = meetings ?? [];
    const thisMonth = list.filter((m) => isSameMonth(new Date(m.starts_at), now));
    const qualifiedThisMonth = thisMonth.filter((m) => (m as any).qualified === true);
    
    const sdrMap = new Map<string, number>();
    for (const m of qualifiedThisMonth) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }
    const activeSdrs = (sdrs ?? []).filter((s) => s.active);
    
    return activeSdrs
      .map((sdr) => {
        const count = sdrMap.get(sdr.user_id) ?? 0;
        const { bonus, nextGoal, missing, isMax } = calculateBonus(count, rules ?? []);
        return {
          id: sdr.user_id,
          name: sdr.profiles?.full_name || "SDR sem nome",
          count,
          bonus,
          nextGoal,
          missing,
          isMax,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [meetings, sdrs, rules, now]);

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-medium mb-6">Ranking da Equipe</h1>
      
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 font-medium text-muted-foreground w-16">Pos</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Bônus</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Próxima Faixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranking.map((sdr, i) => (
                <tr key={sdr.id} className="row-hover">
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      {i < 3 && <Trophy className={cn("size-4", i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600")} />}
                      {i + 1}º
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium">{sdr.name}</td>
                  <td className="py-3 px-4 tabular">{sdr.count}</td>
                  <td className="py-3 px-4 tabular text-success font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sdr.bonus)}
                  </td>
                  <td className="py-3 px-4">
                    {sdr.isMax ? (
                      <span className="text-accent font-medium text-xs">Meta máxima!</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Faltam {sdr.missing}</span>
                    )}
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum SDR ativo encontrado.
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
