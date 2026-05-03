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
 * Oura Ring v2 API adapter.
 * Docs: https://cloud.ouraring.com/v2/docs
 * Auth: OAuth 2.0 + offline refresh. Polled — no webhook product as of v2.
 */
const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const REVOKE_URL = "https://api.ouraring.com/oauth/revoke";
const API_BASE = "https://api.ouraring.com/v2";

const SCOPES = [
  "personal",
  "daily",
  "heartrate",
  "workout",
  "session",
] as const;

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  await tokenBucket.take("oura");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    if (/invalid_grant/i.test(text)) throw new ReauthRequiredError();
    throw new Error(`Oura ${url} ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function get(path: string, token: string): Promise<unknown> {
  await tokenBucket.take("oura");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new ReauthRequiredError();
  if (!res.ok) throw new Error(`Oura GET ${path} ${res.status}`);
  return res.json() as Promise<unknown>;
}

function tokensFrom(json: Record<string, unknown>): ProviderTokens {
  const expiresIn = Number(json.expires_in ?? 86400);
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(/\s+/) : [...SCOPES],
    externalUserId: null,
  };
}

interface OuraDailySleep { day: string; score?: number }
interface OuraSleepSession {
  bedtime_start: string;
  bedtime_end: string;
  total_sleep_duration?: number;
  awake_time?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  deep_sleep_duration?: number;
  efficiency?: number;
  day?: string;
}
interface OuraDailyActivity {
  day: string;
  steps?: number;
  active_calories?: number;
  average_met_minutes?: number;
  high_activity_minutes?: number;
  medium_activity_minutes?: number;
  low_activity_minutes?: number;
}
interface OuraDailyReadiness { day: string; score?: number }
interface OuraDailyHrv { day: string; average_hrv?: number }

export const ouraAdapter: ProviderAdapter = {
  id: "oura",
  category: "wearable",
  displayName: "Oura Ring",
  description: "Sleep stages, HRV, readiness, and daily activity from Oura.",
  syncIntervalMs: 60 * 60 * 1000,
  sandbox: false,
  scopes: SCOPES,
  supportsWebhooks: false,

  oauthAuthorizeUrl(state) {
    const cfg = loadProviderConfig("oura");
    const u = new URL(AUTHORIZE_URL);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async exchangeCode(code) {
    const cfg = loadProviderConfig("oura");
    return tokensFrom(
      await postForm(TOKEN_URL, {
        grant_type: "authorization_code",
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
      }),
    );
  },

  async refresh(refreshToken) {
    const cfg = loadProviderConfig("oura");
    return tokensFrom(
      await postForm(TOKEN_URL, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
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
    if (!token) throw new Error("Oura integration missing access token");
    const start = since.toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    const qs = `?start_date=${start}&end_date=${end}`;
    const [sleep, daily, readiness, hrv] = (await Promise.all([
      get(`/usercollection/sleep${qs}`, token),
      get(`/usercollection/daily_activity${qs}`, token),
      get(`/usercollection/daily_readiness${qs}`, token),
      get(`/usercollection/daily_hrv${qs}`, token),
    ])) as [
      { data?: OuraSleepSession[] },
      { data?: OuraDailyActivity[] },
      { data?: OuraDailyReadiness[] },
      { data?: OuraDailyHrv[] },
    ];
    return mapOura({
      sleep: sleep.data ?? [],
      activity: daily.data ?? [],
      readiness: readiness.data ?? [],
      hrv: hrv.data ?? [],
    });
  },
};

function mapOura(raw: {
  sleep: OuraSleepSession[];
  activity: OuraDailyActivity[];
  readiness: OuraDailyReadiness[];
  hrv: OuraDailyHrv[];
}): NormalisedPayload {
  const out: NormalisedPayload = { biometrics: [], sleep: [], glucose: [], activity: [] };

  for (const s of raw.sleep) {
    if (!s.bedtime_start || !s.bedtime_end) continue;
    const onset = new Date(s.bedtime_start);
    const wake = new Date(s.bedtime_end);
    const sec = (n?: number) => Math.round((n ?? 0) / 60);
    out.sleep.push({
      source: "oura",
      date: s.day ?? onset.toISOString().slice(0, 10),
      totalMinutes: sec(s.total_sleep_duration),
      deepMinutes: sec(s.deep_sleep_duration),
      remMinutes: sec(s.rem_sleep_duration),
      lightMinutes: sec(s.light_sleep_duration),
      awakeMinutes: sec(s.awake_time),
      efficiencyPct: s.efficiency ?? 0,
      onsetAt: onset,
      wakeAt: wake,
    });
  }

  for (const d of raw.activity) {
    if (!d.day) continue;
    const at = new Date(`${d.day}T12:00:00Z`);
    if (typeof d.steps === "number") {
      out.biometrics.push({ source: "oura", metric: "steps", value: d.steps, unit: "count", recordedAt: at });
    }
    const minutes =
      (d.high_activity_minutes ?? 0) +
      (d.medium_activity_minutes ?? 0) +
      (d.low_activity_minutes ?? 0);
    if (minutes > 0) {
      out.activity.push({
        source: "oura",
        type: "daily_activity",
        durationMinutes: minutes,
        intensity:
          (d.high_activity_minutes ?? 0) > 30 ? "high"
          : (d.medium_activity_minutes ?? 0) > 30 ? "moderate"
          : "low",
        strainScore: (d.average_met_minutes ?? 0) / 10,
        avgHeartRate: null,
        calories: d.active_calories ?? null,
        recordedAt: at,
      });
    }
  }

  for (const r of raw.readiness) {
    if (!r.day || typeof r.score !== "number") continue;
    out.biometrics.push({
      source: "oura",
      metric: "readiness_score",
      value: r.score,
      unit: "%",
      recordedAt: new Date(`${r.day}T12:00:00Z`),
    });
  }

  for (const h of raw.hrv) {
    if (!h.day || typeof h.average_hrv !== "number") continue;
    out.biometrics.push({
      source: "oura",
      metric: "hrv_rmssd",
      value: h.average_hrv,
      unit: "ms",
      recordedAt: new Date(`${h.day}T12:00:00Z`),
    });
  }

  return out;
}
