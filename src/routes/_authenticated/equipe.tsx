import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: TeamPage,
});

function TeamPage() {
  const { data: team, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select(`
        user_id,
        role,
        active,
        profiles ( full_name, email )
      `).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    }
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando equipe...</div>;

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">Membros da Equipe</h1>
        <button 
          onClick={() => alert("Convites só podem ser feitos no painel Auth no momento.")}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="size-3.5" /> Convidar Membro
        </button>
      </div>
      
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 font-medium text-muted-foreground">Nome</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Email</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Perfil</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team?.map((member) => (
                <tr key={member.user_id} className="row-hover">
                  <td className="py-3 px-4 font-medium">{member.profiles?.full_name || "Sem nome"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{member.profiles?.email || "-"}</td>
                  <td className="py-3 px-4 capitalize">{member.role}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      member.active 
                        ? "bg-success/10 text-success border border-success/30" 
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {member.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
              {(!team || team.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum membro encontrado.
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
