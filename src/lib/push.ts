import { useEffect, useState } from "react";
import { getVapidKey, saveDeviceSubscription } from "@/lib/push.functions";

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

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Best-effort human labels for the device list. */
export function describeDevice() {
  const ua = navigator.userAgent;
  const browser = isStandalone()
    ? "PWA"
    : /edg\//i.test(ua)
      ? "Edge"
      : /opr\//i.test(ua)
        ? "Opera"
        : /firefox/i.test(ua)
          ? "Firefox"
          : /chrome/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : "Navegador";

  const platform = /android/i.test(ua)
    ? "Android"
    : /iphone|ipod/i.test(ua)
      ? "iPhone"
      : /ipad/i.test(ua)
        ? "iPad"
        : /macintosh|mac os/i.test(ua)
          ? "macOS"
          : /windows/i.test(ua)
            ? "Windows"
            : /linux/i.test(ua)
              ? "Linux"
              : "Desconhecido";

  const mobile = /android|iphone|ipod/i.test(ua);
  const deviceName = mobile ? `Celular ${platform}` : platform === "macOS" ? "Mac" : `Computador ${platform}`;

  return { browser, platform, deviceName, mobile };
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/** Subscribes this browser and stores/refreshes the subscription server-side. */
export async function registerDevice(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  const { key } = await getVapidKey();
  if (!key) return false;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const info = describeDevice();
  await saveDeviceSubscription({
    data: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent.slice(0, 300),
      deviceName: info.deviceName,
      platform: info.platform,
      browser: info.browser,
    },
  });

  return true;
}

export type PushResult = "granted" | "denied" | "unsupported";

/** Requests permission then registers the device. */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const ok = await registerDevice();
  return ok ? "granted" : "unsupported";
}

export function usePushPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");

  useEffect(() => {
    setPermission(pushSupported() ? Notification.permission : "unsupported");
  }, []);

  return { permission, setPermission };
}

/** Keeps this device registered/refreshed whenever permission is already granted. */
export function useDeviceSync() {
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== "granted") return;
    registerDevice().catch(() => undefined);
  }, []);
}
