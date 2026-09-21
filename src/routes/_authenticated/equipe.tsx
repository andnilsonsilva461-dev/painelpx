import { createFileRoute } from "@tanstack/react-router";
import { useMyRole, useAllSDRs, useToggleSDR } from "@/lib/bonus";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { data: role } = useMyRole();
  const { data: sdrs } = useAllSDRs();
  const toggle = useToggleSDR();

  if (role === "sdr") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-medium">Equipe (SDRs)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie o acesso dos membros da equipe comercial.</p>
      </motion.div>

      <div className="mt-6 rounded-lg bg-surface/50 border border-border px-4 py-3 flex items-start gap-3">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Novos membros devem realizar o cadastro através da tela inicial. Uma vez cadastrados,
          eles aparecerão nesta lista para que você possa aprovar ou revogar o acesso (ativar/desativar).
        </p>
      </div>

      <div className="mt-8 panel overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-3 px-4 font-medium text-muted-foreground">Nome</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="py-3 px-4 font-medium text-muted-foreground text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sdrs?.map((sdr) => (
              <tr key={sdr.user_id} className="row-hover">
                <td className="py-3 px-4 font-medium">
                  {sdr.profiles.full_name || "Usuário sem nome configurado"}
                </td>
                <td className="py-3 px-4">
                  {sdr.active ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success border border-success/20">
                      <CheckCircle2 className="size-3" /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive border border-destructive/20">
                      <XCircle className="size-3" /> Inativo
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ userId: sdr.user_id, active: !sdr.active })}
                  >
                    {sdr.active ? "Desativar" : "Ativar"}
                  </Button>
                </td>
              </tr>
            ))}
            {sdrs?.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum SDR registrado no sistema.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
