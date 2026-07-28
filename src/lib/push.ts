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
  const pwa = isStandalone();

  const browser = /edg\//i.test(ua)
    ? "Microsoft Edge"
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
      ? "iOS"
      : /ipad/i.test(ua)
        ? "iPadOS"
        : /macintosh|mac os/i.test(ua)
          ? "macOS"
          : /windows/i.test(ua)
            ? "Windows"
            : /linux/i.test(ua)
              ? "Linux"
              : "Desconhecido";

  let os = platform;
  if (platform === "Windows") os = /windows nt 10|windows nt 11/i.test(ua) ? "Windows 10/11" : "Windows";
  if (platform === "Android") {
    const v = ua.match(/android\s([\d.]+)/i)?.[1];
    os = v ? `Android ${v.split(".")[0]}` : "Android";
  }
  if (platform === "iOS" || platform === "iPadOS") {
    const v = ua.match(/os\s(\d+)_/i)?.[1];
    os = v ? `${platform} ${v}` : platform;
  }

  const mobile = /android|iphone|ipod/i.test(ua);
  const tablet = /ipad/i.test(ua);
  const deviceType: "desktop" | "mobile" | "pwa" = pwa ? "pwa" : mobile || tablet ? "mobile" : "desktop";

  const deviceName = mobile
    ? `Celular ${platform === "iOS" ? "iPhone" : "Android"}`
    : tablet
      ? "Tablet"
      : platform === "macOS"
        ? "Mac"
        : `Computador ${platform}`;

  return { browser, platform, os, deviceName, deviceType, isPwa: pwa, mobile };
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
      os: info.os,
      deviceType: info.deviceType,
      isPwa: info.isPwa,
    },
  });

  return true;
}

/** Endpoint of this browser's current subscription, if any. */
export async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Live snapshot of the browser-side push stack, for the diagnostics panel. */
export async function localDiagnostics() {
  if (!pushSupported()) {
    return {
      supported: false,
      permission: "unsupported" as const,
      serviceWorker: false,
      subscription: false,
      endpoint: null as string | null,
      standalone: isStandalone(),
    };
  }
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    serviceWorker: Boolean(reg?.active ?? reg),
    subscription: Boolean(sub),
    endpoint: sub?.endpoint ?? null,
    standalone: isStandalone(),
  };
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
