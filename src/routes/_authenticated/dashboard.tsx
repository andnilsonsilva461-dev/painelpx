import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, CalendarCheck, Users, Banknote, CalendarClock, ArrowUpRight } from "lucide-react";
import { useAllMeetings } from "@/lib/data";
import { useMyRole, useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { format, isSameMonth } from "date-fns";
import { L } from "@/lib/dates";
import { MeetingDialog } from "@/components/MeetingDialog";
import type { MeetingWithClient } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel Administrador — Pixel Bonus" },
      { name: "description", content: "Visão geral da bonificação da equipe." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useMyRole();
  const { data: meetings } = useAllMeetings();
  const { data: sdrs } = useAllSDRs();
  const { data: rules } = useBonusRules();
  const [selected, setSelected] = useState<MeetingWithClient | null>(null);

  const now = new Date();

  useEffect(() => {
    if (role === "sdr") {
      navigate({ to: "/bonificacao", replace: true });
    }
  }, [role, navigate]);

  const stats = useMemo(() => {
    const list = meetings ?? [];
    const thisMonth = list.filter((m) => isSameMonth(new Date(m.starts_at), now));

    const realizedThisMonth = thisMonth.filter((m) => m.status === "realizada").length;
    const qualifiedThisMonth = thisMonth.filter((m) => (m as any).qualified === true);

    let totalExpectedBonus = 0;
    const sdrMap = new Map<string, number>();

    for (const m of qualifiedThisMonth) {
      sdrMap.set(m.user_id, (sdrMap.get(m.user_id) ?? 0) + 1);
    }

    const activeSdrs = (sdrs ?? []).filter((s) => s.active);

    const ranking = activeSdrs
      .map((sdr) => {
        const count = sdrMap.get(sdr.user_id) ?? 0;
        const { bonus, nextGoal, missing, isMax } = calculateBonus(count, rules ?? []);
        totalExpectedBonus += bonus;
        return {
          id: sdr.user_id,
          name: sdr.profiles.full_name || "SDR sem nome",
          count,
          bonus,
          nextGoal,
          missing,
          isMax,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      qualified: qualifiedThisMonth.length,
      realized: realizedThisMonth,
      expectedBonus: totalExpectedBonus,
      activeSdrs: activeSdrs.length,
      ranking,
    };
  }, [meetings, sdrs, rules, now]);

  if (roleLoading || role === "sdr") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando painel...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-eyebrow">{format(now, "MMMM 'de' yyyy", L)}</p>
        <h1 className="mt-2 text-2xl font-medium">Visão Geral da Equipe</h1>
      </motion.header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Reuniões qualificadas este mês"
          value={stats.qualified}
          icon={CalendarCheck}
          tone="accent"
        />
        <StatCard
          label="Bônus previsto"
          value={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(stats.expectedBonus)}
          icon={Banknote}
          tone="success"
        />
        <StatCard label="SDRs ativos" value={stats.activeSdrs} icon={Users} />
        <StatCard label="Reuniões realizadas" value={stats.realized} icon={CalendarClock} />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-medium">Ranking da Equipe</h2>
          <Link to="/historico" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Ver histórico completo <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 px-4 font-medium text-muted-foreground w-16">Pos</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Reuniões Qualificadas</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Bônus Atual</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Próxima Faixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.ranking.map((sdr, index) => (
                  <tr key={sdr.id} className="row-hover">
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        {index < 3 && <Trophy className={cn("size-4", index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : "text-amber-600")} />}
                        {index + 1}º
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sdr.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular">
                      {sdr.count} reuniões
                    </td>
                    <td className="py-3 px-4 tabular font-medium text-success">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(sdr.bonus)}
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
                {stats.ranking.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum SDR encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MeetingDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} meeting={selected} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: "success" | "accent" }) {
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid size-10 place-items-center rounded-lg border",
          tone === "success" ? "border-success/30 bg-success/10 text-success"
          : tone === "accent" ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border bg-elevated text-muted-foreground"
        )}>
          <Icon className="size-5" />
        </div>
        <p className="text-[13px] font-medium text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className="mt-4 tabular text-3xl font-medium tracking-tight">{value}</p>
    </div>
  );
}
