/**
 * Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) implemented on Web Crypto,
 * so it runs inside the edge/worker runtime. Server-only.
 */

const enc = new TextEncoder();

function b64uToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64u(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

/** HKDF-Expand limited to <= 32 bytes (all we need). */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const out = await hmac(prk, concat(info, new Uint8Array([1])));
  return out.slice(0, length);
}

function vapidJwk(publicKeyB64u: string, privateD: string): JsonWebKey {
  const raw = b64uToBytes(publicKeyB64u);
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64u(raw.slice(1, 33)),
    y: bytesToB64u(raw.slice(33, 65)),
    d: privateD,
    ext: true,
  };
}

async function vapidHeader(audience: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com";

  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64u(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const signingInput = enc.encode(`${header}.${payload}`);

  const key = await crypto.subtle.importKey(
    "jwk",
    vapidJwk(publicKey, privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput as BufferSource),
  );

  return {
    Authorization: `vapid t=${header}.${payload}.${bytesToB64u(sig)}, k=${publicKey}`,
  };
}

async function encryptPayload(payload: string, p256dh: string, auth: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const localPub = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));

  const uaPubBytes = b64uToBytes(p256dh);
  const uaPub = await crypto.subtle.importKey(
    "raw",
    uaPubBytes as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPub }, local.privateKey, 256),
  );

  const authSecret = b64uToBytes(auth);
  const prkKey = await hmac(authSecret, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPubBytes, localPub);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const prk = await hmac(salt, ikm);
  const cek = await hkdfExpand(prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const body = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, body as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([localPub.length]), localPub, ciphertext);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };

/** Returns true when delivered, false when the subscription is gone (410/404). */
export async function sendPush(sub: PushSub, payload: Record<string, unknown>) {
  const body = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
  const audience = new URL(sub.endpoint).origin;
  const headers = await vapidHeader(audience);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "high",
    },
    body: body as BodyInit,
  });

  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  return true;
}
