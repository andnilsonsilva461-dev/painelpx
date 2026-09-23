import { createFileRoute } from "@tanstack/react-router";
import { Gift, Target, Trophy } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/bonificacao")({
  head: () => ({
    meta: [
      { title: "Bonificação — Orbit" },
      { name: "description", content: "Metas e bonificações da sua prospecção." },
      { property: "og:title", content: "Bonificação — Orbit" },
    ],
  }),
  component: BonusPage,
});

function BonusPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-md border border-border bg-elevated">
            <Gift className="size-4" />
          </span>
          <div>
            <h1 className="text-2xl font-medium leading-none">Bonificação</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Acompanhe suas metas e recompensas.</p>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="panel overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <Target className="size-5 text-accent" />
            <div>
              <h2 className="text-[15px] font-medium">Meta de Reuniões</h2>
              <p className="text-[12px] text-muted-foreground">Progresso mensal</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-[13px]">
              <span>24 realizadas</span>
              <span className="font-medium">40</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: "60%" }} />
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-warning" />
            <div>
              <h2 className="text-[15px] font-medium">Bonificação Atual</h2>
              <p className="text-[12px] text-muted-foreground">Recompensa estimada</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-3xl font-medium">R$ 450,00</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Alcance a meta de 40 reuniões para desbloquear R$ 1.000,00.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
