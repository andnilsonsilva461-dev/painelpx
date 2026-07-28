import { BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIOS, isStandalone } from "@/lib/push";

/** Guidance shown when the browser has blocked notification permission. */
export function NotificationsBlocked({ className }: { className?: string }) {
  const ios = isIOS() && !isStandalone();

  return (
    <div
      className={cn(
        "panel border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning)]/[0.06] p-5",
        className,
      )}
    >
      <div className="flex gap-3">
        <BellOff className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Notificações bloqueadas neste navegador</p>
          {ios ? (
            <ol className="mt-2 space-y-1 text-[12px] text-muted-foreground">
              <li>1. Toque em Compartilhar e escolha “Adicionar à Tela de Início”.</li>
              <li>2. Abra o Orbit pelo ícone criado.</li>
              <li>3. Toque em “Ativar agora” e permita as notificações.</li>
            </ol>
          ) : (
            <ol className="mt-2 space-y-1 text-[12px] text-muted-foreground">
              <li>1. Clique no cadeado ao lado do endereço do site.</li>
              <li>2. Em “Notificações”, selecione “Permitir”.</li>
              <li>3. Recarregue a página e ative novamente.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
