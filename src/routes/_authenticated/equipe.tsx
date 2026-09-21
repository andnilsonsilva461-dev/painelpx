import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/bonus";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { data: role, isLoading: roleLoading } = useMyRole();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!roleLoading && role !== "admin") navigate({ to: "/bonificacao", replace: true });
  }, [role, roleLoading, navigate]);

  const { data: team, isLoading } = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          active,
          profiles (
            full_name,
            email,
            display_name
          )
        `)
        .eq("role", "sdr");
      if (error) throw error;
      return data || [];
    },
    enabled: role === "admin"
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.from("user_roles").update({ active }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status do membro atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-team"] });
      qc.invalidateQueries({ queryKey: ["all-sdrs"] });
    }
  });

  if (roleLoading || isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-medium mb-2">Equipe de SDRs</h1>
      <p className="text-sm text-muted-foreground mb-8">Gerencie o acesso e ative/desative membros da equipe comercial.</p>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground">Nome</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Email</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="py-3 px-4 font-medium text-muted-foreground w-20 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {team?.map((member) => (
              <tr key={member.user_id} className="row-hover">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                      <User className="size-4" />
                    </div>
                    <span className="font-medium text-sm">{member.profiles?.full_name || member.profiles?.display_name || "SDR"}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="size-3" /> {member.profiles?.email || "Sem email"}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ${member.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {member.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <Switch
                    checked={member.active}
                    onCheckedChange={(val) => toggleActive.mutate({ userId: member.user_id, active: val })}
                  />
                </td>
              </tr>
            ))}
            {(!team || team.length === 0) && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum SDR cadastrado no sistema.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
