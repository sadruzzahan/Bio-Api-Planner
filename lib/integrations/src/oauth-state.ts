import crypto from "node:crypto";

/**
 * CSRF-resistant OAuth state token.
 *
 * The state is an HMAC-SHA-256 of `{userId, provider, nonce, iat}` keyed
 * on `APP_ENCRYPTION_KEY`. We pack the payload + signature into a single
 * base64url string; the OAuth callback re-derives the HMAC and rejects
 * any token whose signature does not match or whose `iat` is older than
 * STATE_TTL_MS. This also doubles as the place to remember which user
 * initiated the flow without trusting cookies (Clerk session is still
 * required on the callback handler).
 */
const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  userId: number;
  provider: string;
  nonce: string;
  iat: number;
}

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is required for OAuth state signing — see " +
        "artifacts/api-server/docs/encryption-key-rotation.md",
    );
  }
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signOauthState(userId: number, provider: string): string {
  const payload: StatePayload = {
    userId,
    provider,
    nonce: crypto.randomBytes(12).toString("hex"),
    iat: Date.now(),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", key()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyOauthState(
  state: string,
  expectedUserId: number,
  expectedProvider: string,
): void {
  const parts = state.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed OAuth state token");
  }
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", key()).update(body!).digest());
  // Constant-time compare to avoid signature timing oracles.
  const a = Buffer.from(sig!, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("OAuth state signature mismatch (CSRF check failed)");
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(fromB64url(body!).toString("utf8")) as StatePayload;
  } catch {
    throw new Error("OAuth state payload is unreadable");
  }
  if (Date.now() - payload.iat > STATE_TTL_MS) {
    throw new Error("OAuth state expired");
  }
  if (payload.userId !== expectedUserId) {
    throw new Error("OAuth state belongs to a different user");
  }
  if (payload.provider !== expectedProvider) {
    throw new Error("OAuth state belongs to a different provider");
  }
}
