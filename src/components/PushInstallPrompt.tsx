import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enablePush, pushSupported, useSilentPushSync } from "@/lib/push";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Single, calm prompt bar: notification permission first, install second.
 * Never nags — dismissals are remembered.
 */
export function PushInstallPrompt() {
  useSilentPushSync();
  const [needPush, setNeedPush] = useState(false);
  const [installEvent, setInstallEvent] = useState<Prompt | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    const dismissed = localStorage.getItem("orbit-push-dismissed") === "1";
    setNeedPush(Notification.permission === "default" && !dismissed);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem("orbit-install-dismissed") === "1") return;
      setInstallEvent(e as Prompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showPush = needPush;
  const showInstall = !needPush && !!installEvent;
  if (!showPush && !showInstall) return null;

  async function allow() {
    setBusy(true);
    const result = await enablePush().catch(() => "denied" as const);
    setBusy(false);
    setNeedPush(false);
    if (result === "granted") toast.success("Lembretes ativados neste dispositivo");
    else toast.error("Permissão de notificação negada");
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-20 left-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 md:bottom-6 md:left-6 md:translate-x-0"
      >
        <div className="panel flex items-start gap-3 px-4 py-3.5 shadow-[var(--shadow-lift)]">
          <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border bg-elevated">
            {showPush ? <Bell className="size-3.5" /> : <Download className="size-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">
              {showPush ? "Ativar lembretes de reunião" : "Instalar o Orbit"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {showPush
                ? "Receba avisos do sistema operacional mesmo com o navegador fechado."
                : "Abra como aplicativo, com ícone próprio e lembretes mais confiáveis."}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={showPush ? allow : install} disabled={busy}>
                {showPush ? "Ativar" : "Instalar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  if (showPush) {
                    localStorage.setItem("orbit-push-dismissed", "1");
                    setNeedPush(false);
                  } else {
                    localStorage.setItem("orbit-install-dismissed", "1");
                    setInstallEvent(null);
                  }
                }}
              >
                Agora não
              </Button>
            </div>
          </div>
          <button
            aria-label="Fechar"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => (showPush ? setNeedPush(false) : setInstallEvent(null))}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
