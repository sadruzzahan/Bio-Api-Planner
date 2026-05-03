import crypto from "node:crypto";
import {
  type AdapterIntegration,
  type NormalisedPayload,
  type ProviderAdapter,
  type ProviderTokens,
  ReauthRequiredError,
} from "../types";
import { tokenBucket } from "../rate-limiter";
import { loadProviderConfig } from "../registry";

/**
 * Fitbit Web API adapter.
 * Docs: https://dev.fitbit.com/build/reference/web-api/
 * Auth: OAuth 2.0 with PKCE; we use confidential-client + Basic auth on
 * token endpoints which the docs explicitly support for server apps.
 * Webhook subscriptions available for activities, sleep, body, foods.
 */
const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const REVOKE_URL = "https://api.fitbit.com/oauth2/revoke";
const API_BASE = "https://api.fitbit.com";

const SCOPES = ["activity", "heartrate", "sleep", "profile"] as const;

function basicAuth(): string {
  const cfg = loadProviderConfig("fitbit");
  return "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  await tokenBucket.take("fitbit");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: basicAuth(),
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (/invalid_grant/i.test(text)) throw new ReauthRequiredError();
    throw new Error(`Fitbit ${url} ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function get(path: string, token: string): Promise<unknown> {
  await tokenBucket.take("fitbit");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}`, "accept-language": "en_US" },
  });
  if (res.status === 401) throw new ReauthRequiredError();
  if (!res.ok) throw new Error(`Fitbit GET ${path} ${res.status}`);
  return res.json() as Promise<unknown>;
}

function tokensFrom(json: Record<string, unknown>): ProviderTokens {
  const expiresIn = Number(json.expires_in ?? 28_800);
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(/\s+/) : [...SCOPES],
    externalUserId: typeof json.user_id === "string" ? json.user_id : null,
  };
}

interface FitbitActivities {
  activities?: Array<{
    activityName?: string;
    startTime?: string;
    duration?: number;
    averageHeartRate?: number;
    calories?: number;
    activityLevel?: Array<{ name: string; minutes: number }>;
  }>;
}
interface FitbitSleepResp {
  sleep?: Array<{
    dateOfSleep: string;
    startTime: string;
    endTime: string;
    duration: number;
    minutesAsleep: number;
    minutesAwake: number;
    efficiency: number;
    levels?: { summary?: { deep?: { minutes: number }; rem?: { minutes: number }; light?: { minutes: number } } };
  }>;
}

export const fitbitAdapter: ProviderAdapter = {
  id: "fitbit",
  category: "wearable",
  displayName: "Fitbit",
  description: "Activity, heart rate, and sleep from Fitbit devices.",
  syncIntervalMs: 60 * 60 * 1000,
  sandbox: false,
  scopes: SCOPES,
  supportsWebhooks: true,

  oauthAuthorizeUrl(state) {
    const cfg = loadProviderConfig("fitbit");
    const u = new URL(AUTHORIZE_URL);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode(code) {
    const cfg = loadProviderConfig("fitbit");
    return tokensFrom(
      await postForm(TOKEN_URL, {
        grant_type: "authorization_code",
        code,
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
      }),
    );
  },

  async refresh(refreshToken) {
    return tokensFrom(
      await postForm(TOKEN_URL, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    );
  },

  async revoke(accessToken) {
    try {
      await postForm(REVOKE_URL, { token: accessToken });
    } catch {
      // best-effort
    }
  },

  async fetchSince(integration, since) {
    const token = integration.accessToken;
    if (!token) throw new Error("Fitbit integration missing access token");
    const startDate = since.toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);

    const [actsResp, sleepResp, hrResp] = (await Promise.all([
      get(`/1/user/-/activities/list.json?afterDate=${startDate}&sort=asc&limit=20&offset=0`, token),
      get(`/1.2/user/-/sleep/date/${startDate}/${endDate}.json`, token),
      get(`/1/user/-/activities/heart/date/${startDate}/${endDate}.json`, token),
    ])) as [FitbitActivities, FitbitSleepResp, { "activities-heart"?: Array<{ dateTime: string; value?: { restingHeartRate?: number } }> }];

    return mapFitbit({
      activities: actsResp.activities ?? [],
      sleep: sleepResp.sleep ?? [],
      heart: hrResp["activities-heart"] ?? [],
    });
  },

  verifyWebhook(rawBody, headers) {
    const cfg = loadProviderConfig("fitbit");
    const sig = headers["x-fitbit-signature"];
    if (typeof sig !== "string") throw new Error("Missing X-Fitbit-Signature");
    const expected = crypto
      .createHmac("sha1", cfg.clientSecret + "&")
      .update(rawBody)
      .digest("base64");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Fitbit webhook signature mismatch");
    }
  },
};

function mapFitbit(raw: {
  activities: NonNullable<FitbitActivities["activities"]>;
  sleep: NonNullable<FitbitSleepResp["sleep"]>;
  heart: Array<{ dateTime: string; value?: { restingHeartRate?: number } }>;
}): NormalisedPayload {
  const out: NormalisedPayload = { biometrics: [], sleep: [], glucose: [], activity: [] };

  for (const s of raw.sleep) {
    const onset = new Date(s.startTime);
    const wake = new Date(s.endTime);
    const sum = s.levels?.summary;
    out.sleep.push({
      source: "fitbit",
      date: s.dateOfSleep,
      totalMinutes: s.minutesAsleep,
      deepMinutes: sum?.deep?.minutes ?? 0,
      remMinutes: sum?.rem?.minutes ?? 0,
      lightMinutes: sum?.light?.minutes ?? 0,
      awakeMinutes: s.minutesAwake,
      efficiencyPct: s.efficiency,
      onsetAt: onset,
      wakeAt: wake,
    });
  }

  for (const h of raw.heart) {
    const rhr = h.value?.restingHeartRate;
    if (typeof rhr === "number") {
      out.biometrics.push({
        source: "fitbit",
        metric: "resting_heart_rate",
        value: rhr,
        unit: "bpm",
        recordedAt: new Date(`${h.dateTime}T12:00:00Z`),
      });
    }
  }

  for (const a of raw.activities) {
    if (!a.startTime) continue;
    const minutes = Math.round((a.duration ?? 0) / 60_000);
    const high = a.activityLevel?.find((l) => l.name === "very" || l.name === "vigorous")?.minutes ?? 0;
    out.activity.push({
      source: "fitbit",
      type: a.activityName ?? "workout",
      durationMinutes: minutes,
      intensity: high > 20 ? "high" : minutes > 30 ? "moderate" : "low",
      strainScore: minutes / 10,
      avgHeartRate: a.averageHeartRate ?? null,
      calories: a.calories ?? null,
      recordedAt: new Date(a.startTime),
    });
  }

  return out;
}
