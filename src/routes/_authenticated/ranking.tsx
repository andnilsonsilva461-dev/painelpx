import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trophy, Target } from "lucide-react";
import { useAllMeetings } from "@/lib/data";
import { useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { isSameMonth, format } from "date-fns";
import { L } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

function RankingPage() {
  const { data: meetings, isLoading: mLoading } = useAllMeetings();
  const { data: sdrs, isLoading: sLoading } = useAllSDRs();
  const { data: rules, isLoading: rLoading } = useBonusRules();

  const now = new Date();

  const ranking = useMemo(() => {
    if (!meetings || !sdrs || !rules) return [];
    
    const thisMonth = meetings.filter((m) => isSameMonth(new Date(m.starts_at), now));
    const qualifiedThisMonth = thisMonth.filter((m) => (m as any).qualified === true);
    const sdrMap = new Map<string, number>();

    for (const m of qualifiedThisMonth) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }

    const activeSdrs = sdrs.filter((s) => s.active);

    return activeSdrs
      .map((sdr) => {
        const count = sdrMap.get(sdr.user_id) ?? 0;
        const { bonus, nextGoal, missing, isMax } = calculateBonus(count, rules);
        return {
          id: sdr.user_id,
          name: sdr.profiles.full_name || sdr.profiles.display_name || "SDR",
          count,
          bonus,
          nextGoal,
          missing,
          isMax,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [meetings, sdrs, rules, now]);

  if (mLoading || sLoading || rLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando ranking...</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Mês Atual</p>
          <h1 className="mt-2 text-2xl font-medium">Ranking da Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Classificação baseada em reuniões qualificadas em {format(now, "MMMM", L)}.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {ranking.slice(0, 3).map((sdr, index) => (
          <div key={sdr.id} className={cn("panel p-6 flex flex-col items-center text-center relative overflow-hidden", index === 0 && "border-accent/30 bg-accent/5")}>
            {index === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-accent" />}
            <div className={cn("grid size-12 place-items-center rounded-full mb-3", index === 0 ? "bg-yellow-500/20 text-yellow-600" : index === 1 ? "bg-slate-200 text-slate-500" : "bg-amber-600/20 text-amber-700")}>
              <Trophy className="size-6" />
            </div>
            <h3 className="font-medium text-[15px]">{sdr.name}</h3>
            <p className="text-3xl font-medium tabular tracking-tight mt-2">{sdr.count}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Reuniões</p>
            <div className="mt-4 pt-4 border-t border-border w-full flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Bônus Previsto:</span>
              <span className="font-medium text-success">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(sdr.bonus)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground w-16">Pos</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Bônus Atual</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status / Próxima Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranking.slice(3).map((sdr, index) => (
              <tr key={sdr.id} className="row-hover">
                <td className="py-3 px-4 font-medium text-muted-foreground">{index + 4}º</td>
                <td className="py-3 px-4 font-medium">{sdr.name}</td>
                <td className="py-3 px-4 tabular">{sdr.count}</td>
                <td className="py-3 px-4 tabular font-medium text-success">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sdr.bonus)}
                </td>
                <td className="py-3 px-4">
                  {sdr.isMax ? (
                    <span className="text-xs font-medium text-accent flex items-center gap-1.5"><Target className="size-3" /> Máximo Atingido</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Faltam {sdr.missing} para {sdr.nextGoal} reuniões</span>
                  )}
                </td>
              </tr>
            ))}
            {ranking.length <= 3 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum outro SDR cadastrado para listar no ranking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
