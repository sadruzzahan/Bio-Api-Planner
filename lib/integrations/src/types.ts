/**
 * Public types shared by every provider adapter and the sync runner.
 *
 * The adapter contract is deliberately small: each provider exposes the
 * five OAuth-flow methods (authorize URL builder, code exchange, refresh,
 * revoke) plus a `fetchSince`/`mapToBiometrics` pair the sync runner uses
 * to pull and normalise data. Adapters MUST be pure with respect to the
 * database — they never read from or write to our DB directly. The sync
 * runner is responsible for persistence, idempotent inserts, token
 * refresh, and audit logging.
 */

export type ProviderId = "whoop" | "oura" | "fitbit" | "garmin" | "dexcom";

export type ProviderCategory = "wearable" | "cgm";

/** Minimal projection of an integrations row that adapters need to operate. */
export interface AdapterIntegration {
  id: number;
  userId: number;
  provider: ProviderId;
  scopes: string[] | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  externalUserId: string | null;
  metadata: Record<string, unknown>;
}

/** Result of an OAuth code exchange or refresh. */
export interface ProviderTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
  externalUserId: string | null;
  /** Free-form provider-specific metadata to merge into the integration row. */
  metadata?: Record<string, unknown>;
}

/** A single normalised metric reading (one row in biometric_readings). */
export interface NormalisedBiometric {
  source: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: Date;
}

/** A single normalised nightly sleep summary (one row in sleep_sessions). */
export interface NormalisedSleep {
  source: string;
  date: string; // ISO yyyy-mm-dd
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  efficiencyPct: number;
  onsetAt: Date;
  wakeAt: Date;
}

/** A single normalised CGM reading (one row in glucose_readings). */
export interface NormalisedGlucose {
  source: string;
  valueMgdl: number;
  mealContext: string;
  recordedAt: Date;
}

/** A single normalised workout / activity session (one row in activity_sessions). */
export interface NormalisedActivity {
  source: string;
  type: string;
  durationMinutes: number;
  intensity: string;
  strainScore: number;
  avgHeartRate: number | null;
  calories: number | null;
  recordedAt: Date;
}

export interface NormalisedPayload {
  biometrics: NormalisedBiometric[];
  sleep: NormalisedSleep[];
  glucose: NormalisedGlucose[];
  activity: NormalisedActivity[];
}

/**
 * Provider configuration that lives in env vars / Replit Secrets. Resolved
 * at process start by the adapter via `requireConfig()`. We deliberately
 * keep redirect URIs derived from a single `OAUTH_REDIRECT_BASE` so that
 * adding a new provider only requires the `*_CLIENT_ID` + `*_CLIENT_SECRET`
 * pair. The `sandbox` flag exists because Dexcom (and historically Whoop)
 * ship a separate sandbox host that uses sandbox-issued credentials.
 */
export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandbox: boolean;
}

/**
 * Rate-limiter contract — adapters call `await tokenBucket.take(provider)`
 * before every outbound HTTP request. Implemented in `rate-limiter.ts`.
 */
export interface RateLimiter {
  take(provider: ProviderId): Promise<void>;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly category: ProviderCategory;
  readonly displayName: string;
  readonly description: string;
  /** Provider-recommended sync cadence in milliseconds. */
  readonly syncIntervalMs: number;
  /** Whether the provider is currently behind a sandbox/partner gate. */
  readonly sandbox: boolean;
  /** OAuth scopes we request. */
  readonly scopes: readonly string[];
  /** Whether this provider pushes data via webhooks (vs poll only). */
  readonly supportsWebhooks: boolean;

  /** Construct the provider's hosted OAuth authorize URL for the given state. */
  oauthAuthorizeUrl(state: string): string;

  /** Exchange an OAuth authorization code for tokens. */
  exchangeCode(code: string): Promise<ProviderTokens>;

  /** Refresh tokens. Throws `ReauthRequiredError` if the refresh token is invalid. */
  refresh(refreshToken: string): Promise<ProviderTokens>;

  /** Best-effort token revocation. Some providers don't expose an endpoint. */
  revoke(accessToken: string): Promise<void>;

  /** Pull all available data since `since`. The runner refreshes tokens first. */
  fetchSince(integration: AdapterIntegration, since: Date): Promise<NormalisedPayload>;

  /**
   * Verify a webhook signature header against the raw body. Throws on
   * mismatch. Providers that do not push return `false` from
   * `supportsWebhooks` and never have this method called.
   */
  verifyWebhook?(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): void;
}

/**
 * Sentinel thrown by `refresh()` when the provider returns
 * `invalid_grant` (typically because the user revoked at the provider
 * end, or the refresh token expired). The sync runner catches this and
 * transitions the integration to `needs_reauth`.
 */
export class ReauthRequiredError extends Error {
  constructor(message = "Refresh token rejected — user must re-authenticate") {
    super(message);
    this.name = "ReauthRequiredError";
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: ProviderId, missing: string) {
    super(
      `Provider "${provider}" is not configured: ${missing} is missing. ` +
        `Set the corresponding Replit Secret to enable this integration.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}
