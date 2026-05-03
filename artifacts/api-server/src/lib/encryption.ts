import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Refusing to start. Generate a key with `openssl rand -base64 32` and store as a secret.",
    );
  }
  // Accept either base64 or 64-char hex.
  let key: Buffer;
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use 32 bytes of base64 or 64 hex chars.`,
    );
  }
  return key;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = getKey();
  return cachedKey;
}

/**
 * Encrypt UTF-8 plaintext with AES-256-GCM. Output format:
 *   v1:<base64-iv>:<base64-tag>:<base64-ciphertext>
 * The version prefix lets us rotate algorithms or keys later without
 * breaking existing rows.
 */
export function encrypt(plaintext: string): string {
  if (plaintext === "" || plaintext == null) return plaintext;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    // Not encrypted yet (or unknown format) — return as-is so callers can
    // tolerate mixed plaintext/ciphertext during the backfill window.
    return token;
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const ct = Buffer.from(ctB64!, "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Encrypted payload corrupted: bad iv/tag length");
  }
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Deterministic email lookup hash. We use HMAC-SHA-256 keyed on the encryption
 * key so the lookup column cannot be brute-forced from a leaked DB dump alone
 * (the attacker also needs APP_ENCRYPTION_KEY). Email is normalised to
 * lower-case + trimmed before hashing.
 */
export function emailLookupHash(email: string): string {
  const normalised = email.trim().toLowerCase();
  return crypto.createHmac("sha256", key()).update(normalised).digest("hex");
}

/**
 * Encrypt every string value at the top level of a metadata object, leaving
 * non-string values alone. Used for integration `metadata` to protect tokens
 * that providers stash in there (access_token, refresh_token, etc.) while
 * keeping the surrounding shape readable.
 */
export function encryptSecretsInObject(
  obj: Record<string, unknown>,
  secretKeys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of secretKeys) {
    const v = out[k];
    if (typeof v === "string" && v.length > 0) {
      out[k] = encrypt(v);
    }
  }
  return out;
}

export function decryptSecretsInObject(
  obj: Record<string, unknown>,
  secretKeys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of secretKeys) {
    const v = out[k];
    if (typeof v === "string") {
      try {
        const dec = decrypt(v);
        if (dec !== null) out[k] = dec;
      } catch {
        // leave value as-is if decryption fails (mixed legacy data).
      }
    }
  }
  return out;
}

export const SECRET_INTEGRATION_FIELDS = [
  "access_token",
  "refresh_token",
  "api_key",
  "client_secret",
] as const;
