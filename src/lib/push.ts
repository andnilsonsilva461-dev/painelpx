import { useEffect, useState } from "react";
import { getVapidKey, savePushSubscription, sendTestPush } from "@/lib/push.functions";

const SW_PATH = "/sw.js";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/** Requests permission, subscribes the browser and stores the subscription server-side. */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  const { key } = await getVapidKey();
  if (!key) return "unsupported";

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "denied";

  await savePushSubscription({
    data: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent.slice(0, 300),
    },
  });

  await sendTestPush({ data: undefined as never }).catch(() => undefined);
  return "granted";
}

export function usePushStatus() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!pushSupported()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  return { permission, setPermission };
}

/** Registers the worker silently when the user already granted permission. */
export function useSilentPushSync() {
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== "granted") return;
    enablePush().catch(() => undefined);
  }, []);
}
