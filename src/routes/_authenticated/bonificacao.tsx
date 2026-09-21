import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Target, Trophy, Info, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAllMeetings, useSession } from "@/lib/data";
import { useBonusRules, calculateBonus } from "@/lib/bonus";
import { format, isSameMonth } from "date-fns";
import { L } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/bonificacao")({
  head: () => ({
    meta: [
      { title: "Meu Desempenho — Pixel Bonus" },
      { name: "description", content: "Acompanhe seu progresso e bônus." },
    ],
  }),
  component: SDRProgressPage,
});

function SDRProgressPage() {
  const { data: user } = useSession();
  const { data: meetings } = useAllMeetings();
  const { data: rules } = useBonusRules();

  const now = new Date();

  const stats = useMemo(() => {
    const myMeetings = (meetings ?? []).filter((m) => m.user_id === user?.id);
    const thisMonth = myMeetings.filter((m) => isSameMonth(new Date(m.starts_at), now));
    
    // Count only qualified meetings
    const qualifiedCount = thisMonth.filter((m) => (m as any).qualified === true).length;

    return calculateBonus(qualifiedCount, rules ?? []);
  }, [meetings, rules, user, now]);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "SDR";

  // Calculando a % da barra de progresso em relação à próxima meta
  // Se não tem nextGoal, barra está em 100%
  const progressPct = stats.isMax || !stats.nextGoal
    ? 100
    : Math.min(100, Math.round(((stats.nextGoal - stats.missing) / stats.nextGoal) * 100));

  return (
    <div className="mx-auto w-full max-w-[700px] px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-medium tracking-tight">Olá, {firstName} 👋</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Seu desempenho em <strong className="font-medium text-foreground capitalize">{format(now, "MMMM", L)}</strong>
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="panel flex flex-col justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Target className="size-5" />
            </div>
            <h2 className="text-[14px] font-medium">Reuniões qualificadas</h2>
          </div>
          <div className="mt-6">
            <p className="text-5xl font-medium tracking-tight tabular">
              {(stats.nextGoal ? stats.nextGoal - stats.missing : 0) || (rules ? Math.max(...rules.map(r => r.min_meetings)) : 0)}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Total aprovado no mês.
            </p>
          </div>
        </section>

        <section className="panel flex flex-col justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-success/30 bg-success/10 text-success">
              <Trophy className="size-5" />
            </div>
            <h2 className="text-[14px] font-medium">Bônus atual</h2>
          </div>
          <div className="mt-6">
            <p className="text-5xl font-medium tracking-tight text-success tabular">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }).format(stats.bonus)}
            </p>
            {!stats.isMax && stats.nextGoal && (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Faltam só <strong className="text-foreground font-medium">{stats.missing} reuniões</strong> para a próxima faixa.
              </p>
            )}
            {stats.isMax && (
              <p className="mt-2 text-[13px] font-medium text-accent">
                META MÁXIMA ATINGIDA 🎉
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 panel p-6">
        <div className="flex items-center justify-between text-[13px] mb-3">
          <span className="font-medium">
            {stats.nextGoal ? stats.nextGoal - stats.missing : "Máximo"} / {stats.nextGoal || "Máximo"}
          </span>
          <span className="text-muted-foreground">
            {stats.isMax ? "Parabéns!" : `Próximo marco: ${stats.nextGoal} reuniões`}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted border border-border/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-accent"
          />
        </div>
      </div>

      <div className="mt-8 panel p-6">
        <h2 className="text-lg font-medium mb-4">Como funciona o bônus?</h2>
        <p className="text-[13px] text-muted-foreground mb-4">
          A bonificação é calculada de acordo com a quantidade de reuniões qualificadas marcadas pelo SDR durante o mês. O bônus é por faixa e não acumulativo.
        </p>
        <div className="space-y-2">
          {rules && rules.length > 0 && (
            <div className="flex justify-between items-center text-sm p-3 rounded-md border border-border bg-surface">
              <span className="font-medium text-muted-foreground">
                Até {Math.min(...rules.map(r => r.min_meetings)) - 1} reuniões
              </span>
              <span className="font-semibold text-muted-foreground">R$ 0,00</span>
            </div>
          )}
          
          {rules && rules.length > 0 ? [...rules].sort((a,b) => a.min_meetings - b.min_meetings).map((rule, i, arr) => {
            const next = arr[i+1];
            const range = next 
              ? `${rule.min_meetings} a ${next.min_meetings - 1} reuniões` 
              : `${rule.min_meetings} ou mais reuniões`;
            
            return (
              <div key={rule.id} className="flex justify-between items-center text-sm p-3 rounded-md border border-border bg-surface">
                <span className="font-medium text-muted-foreground">{range}</span>
                <span className="font-semibold text-success">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rule.bonus_amount)}
                </span>
              </div>
            )
          }) : (
             <p className="text-sm text-muted-foreground">Nenhuma regra de bonificação configurada.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-surface/50 border border-border px-4 py-3 flex items-start gap-3">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          O bônus é calculado automaticamente sobre as reuniões que o administrador marca como <strong className="text-foreground font-medium">Qualificadas</strong>. 
          Reuniões canceladas ou inválidas não entram na contagem. O bônus não é acumulativo.
        </p>
      </div>
    </div>
  );
}
