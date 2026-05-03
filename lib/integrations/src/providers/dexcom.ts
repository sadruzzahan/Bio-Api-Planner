import crypto from "node:crypto";
import {
  type NormalisedPayload,
  type ProviderAdapter,
  type ProviderTokens,
  ReauthRequiredError,
} from "../types";
import { tokenBucket } from "../rate-limiter";
import { loadProviderConfig } from "../registry";

/**
 * Dexcom v3 CGM API.
 * Docs: https://developer.dexcom.com/overview
 * Auth: OAuth 2.0. Production keys require partner approval — sandbox is
 * the safe default until they land. Sandbox host: api.dexcom.com vs
 * sandbox-api.dexcom.com.
 */
function host(sandbox: boolean): string {
  return sandbox ? "https://sandbox-api.dexcom.com" : "https://api.dexcom.com";
}
const AUTHORIZE_PATH = "/v2/oauth2/login";
const TOKEN_PATH = "/v2/oauth2/token";

const SCOPES = ["offline_access"] as const;

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  await tokenBucket.take("dexcom");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (/invalid_grant/i.test(text)) throw new ReauthRequiredError();
    throw new Error(`Dexcom ${url} ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function get(base: string, path: string, token: string): Promise<unknown> {
  await tokenBucket.take("dexcom");
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new ReauthRequiredError();
  if (!res.ok) throw new Error(`Dexcom GET ${path} ${res.status}`);
  return res.json() as Promise<unknown>;
}

function tokensFrom(json: Record<string, unknown>): ProviderTokens {
  const expiresIn = Number(json.expires_in ?? 7200);
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(/\s+/) : [...SCOPES],
    externalUserId: null,
  };
}

interface DexcomEgvsResp {
  records?: Array<{
    systemTime: string;
    value: number;
    unit: string;
    trend?: string;
  }>;
}

export const dexcomAdapter: ProviderAdapter = {
  id: "dexcom",
  category: "cgm",
  displayName: "Dexcom CGM",
  description: "Continuous glucose readings from Dexcom G6/G7 sensors.",
  // Dexcom updates EGVs every 5 minutes; poll at 15 min to stay well under
  // their per-minute quota while keeping dashboards fresh.
  syncIntervalMs: 15 * 60 * 1000,
  // Resolved at request time so flipping DEXCOM_SANDBOX (or moving from
  // sandbox to partner-approved prod credentials) takes effect without
  // a server restart and is reported accurately on the integrations UI.
  get sandbox(): boolean {
    const v = process.env.DEXCOM_SANDBOX;
    if (v === "false" || v === "0") return false;
    return true;
  },
  scopes: SCOPES,
  supportsWebhooks: true,

  // Dexcom signs notification callbacks with HMAC-SHA256 of the raw
  // request body using the partner client secret as the key, delivered
  // in the `x-dexcom-signature` header (hex-lowercase). We compare with
  // a constant-time check; the public webhook router calls this BEFORE
  // any JSON parsing happens (raw body preserved).
  verifyWebhook(rawBody, headers) {
    const cfg = loadProviderConfig("dexcom");
    const sig = String(
      headers["x-dexcom-signature"] ?? headers["x-dexcom-signature-256"] ?? "",
    ).toLowerCase();
    if (!sig) throw new Error("missing dexcom signature header");
    const expected = crypto
      .createHmac("sha256", cfg.clientSecret)
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("dexcom signature mismatch");
    }
  },

  oauthAuthorizeUrl(state) {
    const cfg = loadProviderConfig("dexcom");
    const u = new URL(`${host(cfg.sandbox)}${AUTHORIZE_PATH}`);
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode(code) {
    const cfg = loadProviderConfig("dexcom");
    return tokensFrom(
      await postForm(`${host(cfg.sandbox)}${TOKEN_PATH}`, {
        grant_type: "authorization_code",
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
      }),
    );
  },

  async refresh(refreshToken) {
    const cfg = loadProviderConfig("dexcom");
    return tokensFrom(
      await postForm(`${host(cfg.sandbox)}${TOKEN_PATH}`, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
      }),
    );
  },

  async revoke(_accessToken) {
    // Dexcom does not expose a revoke endpoint as of API v3 — local
    // disconnect wipes our copy of the tokens.
  },

  async fetchSince(integration, since) {
    const cfg = loadProviderConfig("dexcom");
    const token = integration.accessToken;
    if (!token) throw new Error("Dexcom integration missing access token");
    const startDate = since.toISOString();
    const endDate = new Date().toISOString();
    const path = `/v3/users/self/egvs?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const json = (await get(host(cfg.sandbox), path, token)) as DexcomEgvsResp;
    return mapDexcom(json.records ?? []);
  },
};

function mapDexcom(records: NonNullable<DexcomEgvsResp["records"]>): NormalisedPayload {
  const out: NormalisedPayload = { biometrics: [], sleep: [], glucose: [], activity: [] };
  for (const r of records) {
    if (!r.systemTime || typeof r.value !== "number") continue;
    // Dexcom returns mg/dL by default but check unit just in case the
    // user is on an mmol/L locale.
    const mgdl = r.unit === "mmol/L" ? r.value * 18.018 : r.value;
    out.glucose.push({
      source: "dexcom",
      valueMgdl: mgdl,
      mealContext: "ambient",
      recordedAt: new Date(r.systemTime),
    });
  }
  return out;
}
