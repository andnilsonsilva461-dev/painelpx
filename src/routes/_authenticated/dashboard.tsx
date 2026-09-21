import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trophy, CalendarCheck, Users, Banknote, CalendarClock, Target, Activity, Shield } from "lucide-react";
import { useAllMeetings } from "@/lib/data";
import { useMyRole, useAllSDRs, useBonusRules, calculateBonus } from "@/lib/bonus";
import { format, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pixel Graphics" },
      { name: "description", content: "Visão geral de desempenho e acompanhamento em tempo real." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data: role, isLoading: roleLoading } = useMyRole();
  const { data: user } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: meetings } = useAllMeetings();
  const { data: sdrs } = useAllSDRs();
  const { data: rules } = useBonusRules();

  const { data: prospects } = useQuery({
    queryKey: ["prospects_all"],
    queryFn: async () => {
      const { data } = await supabase.from("prospects").select("*");
      return data || [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["history_events_recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("history_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  // Invalidate queries in real-time for immediate feedback
  useEffect(() => {
    const sub = supabase
      .channel("dashboard_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        qc.invalidateQueries({ queryKey: ["prospects_all"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "history_events" }, () => {
        qc.invalidateQueries({ queryKey: ["history_events_recent"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [qc]);

  if (roleLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando painel...</div>;
  }

  if (role === "sdr") {
    return (
      <SDRDashboard 
        userId={user?.id}
        meetings={meetings} 
        prospects={prospects}
        rules={rules}
      />
    );
  }

  return (
    <AdminDashboard 
      meetings={meetings} 
      prospects={prospects} 
      history={history} 
      profiles={profiles}
      sdrs={sdrs}
      rules={rules}
    />
  );
}

// -----------------------------------------------------------------------------
// SDR DASHBOARD
// -----------------------------------------------------------------------------
function SDRDashboard({ userId, meetings, prospects, rules }: any) {
  const now = new Date();
  
  const myMeetings = (meetings || []).filter((m: any) => m.user_id === userId);
  const myProspects = (prospects || []).filter((p: any) => p.user_id === userId);
  
  const thisMonthMeetings = myMeetings.filter((m: any) => isSameMonth(new Date(m.starts_at), now));
  
  const prospectsAbordados = myProspects.filter((p: any) => p.status_funnel !== 'Novo').length;
  const respostas = myProspects.filter((p: any) => ['Respondeu', 'Em negociação', 'Reunião marcada', 'Reunião realizada', 'Proposta enviada', 'Fechado'].includes(p.status_funnel)).length;
  const propostas = myProspects.filter((p: any) => p.status_funnel === 'Proposta enviada').length;
  const vendas = myProspects.filter((p: any) => p.status_funnel === 'Fechado').length;
  
  const marcadas = thisMonthMeetings.length;
  const realizadas = thisMonthMeetings.filter((m: any) => m.status === 'realizada').length;
  const qualificadas = thisMonthMeetings.filter((m: any) => m.qualified === true).length;
  
  const { bonus, nextGoal, missing, isMax } = calculateBonus(qualificadas, rules || []);
  const progressValue = nextGoal ? (qualificadas / nextGoal) * 100 : 0;
  
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-medium mb-6">Meu Desempenho</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Prospects Abordados" value={prospectsAbordados} icon={Users} />
        <StatCard label="Respostas" value={respostas} icon={Activity} />
        <StatCard label="Reuniões Marcadas" value={marcadas} icon={CalendarCheck} />
        <StatCard label="Realizadas" value={realizadas} icon={CalendarClock} />
        <StatCard label="Propostas" value={propostas} icon={Target} />
        <StatCard label="Vendas" value={vendas} icon={Trophy} tone="success" />
        <StatCard label="Reuniões Qualificadas" value={qualificadas} icon={CalendarCheck} tone="accent" />
        <StatCard label="Bônus Atual" value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(bonus)} icon={Banknote} tone="success" />
      </div>

      <div className="panel p-6 mb-8">
        <h2 className="text-lg font-medium mb-2">Progresso da Bonificação</h2>
        {isMax ? (
          <p className="text-sm text-success font-medium">Parabéns! Você atingiu a faixa máxima de bônus.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Faltam <strong className="text-foreground">{missing}</strong> reuniões para chegar ao próximo bônus de <strong>R$ {rules?.find((r: any) => r.min_meetings === nextGoal)?.bonus_amount || 0}</strong>.
            </p>
            <Progress value={progressValue} className="h-3 rounded-full bg-muted" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{qualificadas} qualificadas</span>
              <span>Meta: {nextGoal}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN DASHBOARD
// -----------------------------------------------------------------------------
function AdminDashboard({ meetings, prospects, history, profiles, sdrs, rules }: any) {
  const now = new Date();
  
  const allMeetings = meetings || [];
  const allProspects = prospects || [];
  
  const thisMonthMeetings = allMeetings.filter((m: any) => isSameMonth(new Date(m.starts_at), now));
  
  const prospectsHoje = allProspects.filter((p: any) => isToday(new Date(p.created_at))).length;
  const prospectsAbordados = allProspects.filter((p: any) => p.status_funnel && p.status_funnel !== 'Novo').length;
  const respostas = allProspects.filter((p: any) => ['Respondeu', 'Em negociação', 'Reunião marcada', 'Reunião realizada', 'Proposta enviada', 'Fechado'].includes(p.status_funnel)).length;
  
  const marcadas = thisMonthMeetings.length;
  const realizadas = thisMonthMeetings.filter((m: any) => m.status === 'realizada').length;
  const pendentes = thisMonthMeetings.filter((m: any) => m.status === 'agendada' || m.status === 'confirmada').length;
  
  let totalBonus = 0;
  const sdrMap = new Map();
  const qualificadasThisMonth = thisMonthMeetings.filter((m: any) => m.qualified === true);
  for (const m of qualificadasThisMonth) {
    sdrMap.set(m.user_id, (sdrMap.get(m.user_id) || 0) + 1);
  }
  for (const sdr of sdrs || []) {
    if (sdr.active) {
      const { bonus } = calculateBonus(sdrMap.get(sdr.user_id) || 0, rules || []);
      totalBonus += bonus;
    }
  }

  function getProfileName(id: string) {
    return profiles?.find((p: any) => p.id === id)?.full_name || "Membro";
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium mb-2">Dashboard Geral</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento em tempo real da equipe.</p>
        </div>
        <Link 
          to="/admin" 
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm hover:bg-accent/90"
        >
          <Shield className="size-4" />
          Administração
        </Link>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Prospects Hoje" value={prospectsHoje} icon={Target} />
        <StatCard label="Prospects Abordados" value={prospectsAbordados} icon={Users} />
        <StatCard label="Respostas" value={respostas} icon={Activity} />
        <StatCard label="Reuniões Marcadas" value={marcadas} icon={CalendarCheck} />
        <StatCard label="Reuniões Realizadas" value={realizadas} icon={CalendarClock} />
        <StatCard label="Reuniões Pendentes" value={pendentes} icon={CalendarClock} />
        <StatCard label="Bônus Atual Equipe" value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalBonus)} icon={Banknote} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-[15px] font-medium mb-4">Acompanhamento em Tempo Real (SDRs)</h2>
          <div className="panel overflow-hidden">
             <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-medium text-muted-foreground">SDR</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Abordados</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Respostas</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Marcadas</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Realizadas</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Conversões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(sdrs || []).filter((s: any) => s.active).map((sdr: any) => {
                  const sdrId = sdr.user_id;
                  const sdrName = getProfileName(sdrId);
                  const sdrProspects = allProspects.filter((p: any) => p.user_id === sdrId);
                  const sdrMeetings = thisMonthMeetings.filter((m: any) => m.user_id === sdrId);
                  
                  const sAbordados = sdrProspects.filter((p: any) => p.status_funnel !== 'Novo').length;
                  const sRespostas = sdrProspects.filter((p: any) => ['Respondeu', 'Em negociação', 'Reunião marcada', 'Reunião realizada', 'Proposta enviada', 'Fechado'].includes(p.status_funnel)).length;
                  const sMarcadas = sdrMeetings.length;
                  const sRealizadas = sdrMeetings.filter((m: any) => m.status === 'realizada').length;
                  const sConversoes = sdrProspects.filter((p: any) => p.status_funnel === 'Fechado').length;

                  return (
                    <tr key={sdrId} className="row-hover">
                      <td className="py-3 px-4 font-medium">{sdrName}</td>
                      <td className="py-3 px-4 tabular">{sAbordados}</td>
                      <td className="py-3 px-4 tabular">{sRespostas}</td>
                      <td className="py-3 px-4 tabular">{sMarcadas}</td>
                      <td className="py-3 px-4 tabular">{sRealizadas}</td>
                      <td className="py-3 px-4 tabular text-success font-medium">{sConversoes}</td>
                    </tr>
                  )
                })}
                {(!sdrs || sdrs.filter((s: any) => s.active).length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum SDR ativo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-medium mb-4">Atividades Recentes</h2>
          <div className="panel p-0 overflow-hidden flex flex-col">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
              {(history || []).map((event: any) => (
                <div key={event.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5 shrink-0">
                    <div className="size-2 rounded-full bg-primary/80 ring-4 ring-primary/10" />
                  </div>
                  <div>
                    <p className="text-foreground leading-tight">
                      <span className="font-medium">{getProfileName(event.user_id)}</span>{" "}
                      <span className="text-muted-foreground">{event.description || event.event_type}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {format(new Date(event.created_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
              {(!history || history.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade recente.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
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
