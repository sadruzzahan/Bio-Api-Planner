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
 * Whoop API v1 adapter.
 *
 * Docs: https://developer.whoop.com/api
 * Auth: OAuth 2.0 + refresh tokens. Webhook delivery available for sleep,
 * recovery, workout, body-measurement events. Hourly poll cadence is fine
 * as a fallback.
 */
const AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";

const SCOPES = [
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:cycles",
  "read:profile",
  "offline",
] as const;

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  await tokenBucket.take("whoop");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /invalid_grant/i.test(text)) {
      throw new ReauthRequiredError();
    }
    throw new Error(`Whoop ${url} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function get(path: string, accessToken: string): Promise<unknown> {
  await tokenBucket.take("whoop");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new ReauthRequiredError();
  if (!res.ok) {
    throw new Error(`Whoop GET ${path} failed ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

export const whoopAdapter: ProviderAdapter = {
  id: "whoop",
  category: "wearable",
  displayName: "Whoop",
  description: "Recovery, strain, and sleep from your Whoop strap.",
  syncIntervalMs: 60 * 60 * 1000,
  sandbox: false,
  scopes: SCOPES,
  supportsWebhooks: true,

  oauthAuthorizeUrl(state) {
    const cfg = loadProviderConfig("whoop");
    const u = new URL(AUTHORIZE_URL);
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode(code) {
    const cfg = loadProviderConfig("whoop");
    const json = await postForm(TOKEN_URL, {
      grant_type: "authorization_code",
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
    });
    return tokensFromResponse(json);
  },

  async refresh(refreshToken) {
    const cfg = loadProviderConfig("whoop");
    const json = await postForm(TOKEN_URL, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: SCOPES.join(" "),
    });
    return tokensFromResponse(json);
  },

  async revoke(_accessToken) {
    // Whoop has no public token-revocation endpoint as of writing; the
    // user must remove the app from their Whoop account UI. We still
    // wipe local tokens in the disconnect handler so subsequent syncs
    // stop running.
    return;
  },

  async fetchSince(integration, since) {
    const accessToken = integration.accessToken;
    if (!accessToken) throw new Error("Whoop integration missing access token");
    const isoSince = since.toISOString();

    // Each endpoint is paginated; for simplicity we pull the first page
    // (which is the most recent batch). The scheduler runs us hourly so
    // a single page typically covers everything new.
    const sleepRaw = (await get(
      `/v1/activity/sleep?start=${encodeURIComponent(isoSince)}`,
      accessToken,
    )) as { records?: WhoopSleep[] };
    const recRaw = (await get(
      `/v1/recovery?start=${encodeURIComponent(isoSince)}`,
      accessToken,
    )) as { records?: WhoopRecovery[] };
    const wkRaw = (await get(
      `/v1/activity/workout?start=${encodeURIComponent(isoSince)}`,
      accessToken,
    )) as { records?: WhoopWorkout[] };

    return mapWhoop({
      sleep: sleepRaw.records ?? [],
      recovery: recRaw.records ?? [],
      workouts: wkRaw.records ?? [],
    });
  },

  verifyWebhook(rawBody, headers) {
    const cfg = loadProviderConfig("whoop");
    const sig = headers["x-whoop-signature"];
    if (typeof sig !== "string") {
      throw new Error("Missing X-WHOOP-Signature header");
    }
    const expected = crypto
      .createHmac("sha256", cfg.clientSecret)
      .update(rawBody)
      .digest("base64");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Whoop webhook signature mismatch");
    }
  },
};

function tokensFromResponse(json: Record<string, unknown>): ProviderTokens {
  const accessToken = String(json.access_token ?? "");
  const refreshToken =
    typeof json.refresh_token === "string" ? json.refresh_token : null;
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(/\s+/) : [...SCOPES],
    externalUserId:
      typeof json.user_id === "string" || typeof json.user_id === "number"
        ? String(json.user_id)
        : null,
  };
}

interface WhoopSleep {
  start: string;
  end: string;
  score?: { stage_summary?: {
    total_in_bed_time_milli?: number;
    total_awake_time_milli?: number;
    total_no_data_time_milli?: number;
    total_light_sleep_time_milli?: number;
    total_slow_wave_sleep_time_milli?: number;
    total_rem_sleep_time_milli?: number;
    sleep_efficiency_percentage?: number;
  } };
}
interface WhoopRecovery {
  created_at: string;
  score?: { recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number };
}
interface WhoopWorkout {
  start: string;
  end: string;
  sport_id?: number;
  score?: { strain?: number; average_heart_rate?: number; kilojoule?: number };
}

function mapWhoop(raw: {
  sleep: WhoopSleep[];
  recovery: WhoopRecovery[];
  workouts: WhoopWorkout[];
}): NormalisedPayload {
  const out: NormalisedPayload = {
    biometrics: [],
    sleep: [],
    glucose: [],
    activity: [],
  };

  for (const s of raw.sleep) {
    const stages = s.score?.stage_summary;
    if (!stages || !s.start || !s.end) continue;
    const onsetAt = new Date(s.start);
    const wakeAt = new Date(s.end);
    const totalMs = stages.total_in_bed_time_milli ?? 0;
    out.sleep.push({
      source: "whoop",
      date: onsetAt.toISOString().slice(0, 10),
      totalMinutes: Math.round(totalMs / 60_000),
      deepMinutes: Math.round((stages.total_slow_wave_sleep_time_milli ?? 0) / 60_000),
      remMinutes: Math.round((stages.total_rem_sleep_time_milli ?? 0) / 60_000),
      lightMinutes: Math.round((stages.total_light_sleep_time_milli ?? 0) / 60_000),
      awakeMinutes: Math.round((stages.total_awake_time_milli ?? 0) / 60_000),
      efficiencyPct: stages.sleep_efficiency_percentage ?? 0,
      onsetAt,
      wakeAt,
    });
  }

  for (const r of raw.recovery) {
    if (!r.created_at) continue;
    const at = new Date(r.created_at);
    if (typeof r.score?.hrv_rmssd_milli === "number") {
      out.biometrics.push({
        source: "whoop",
        metric: "hrv_rmssd",
        value: r.score.hrv_rmssd_milli,
        unit: "ms",
        recordedAt: at,
      });
    }
    if (typeof r.score?.resting_heart_rate === "number") {
      out.biometrics.push({
        source: "whoop",
        metric: "resting_heart_rate",
        value: r.score.resting_heart_rate,
        unit: "bpm",
        recordedAt: at,
      });
    }
    if (typeof r.score?.recovery_score === "number") {
      out.biometrics.push({
        source: "whoop",
        metric: "recovery_score",
        value: r.score.recovery_score,
        unit: "%",
        recordedAt: at,
      });
    }
  }

  for (const w of raw.workouts) {
    if (!w.start || !w.end) continue;
    const start = new Date(w.start);
    const end = new Date(w.end);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
    const strain = w.score?.strain ?? 0;
    const intensity =
      strain >= 18 ? "high" : strain >= 10 ? "moderate" : "low";
    out.activity.push({
      source: "whoop",
      type: w.sport_id != null ? `whoop_sport_${w.sport_id}` : "workout",
      durationMinutes: minutes,
      intensity,
      strainScore: strain,
      avgHeartRate: w.score?.average_heart_rate ?? null,
      calories:
        typeof w.score?.kilojoule === "number"
          ? Math.round(w.score.kilojoule / 4.184)
          : null,
      recordedAt: start,
    });
  }

  return out;
}
