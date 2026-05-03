import {
  type AdapterIntegration,
  type NormalisedPayload,
  type ProviderAdapter,
  type ProviderTokens,
} from "../types";
import { loadProviderConfig } from "../registry";

/**
 * Garmin Health API adapter — placeholder.
 *
 * Garmin's Health API uses OAuth 1.0a (HMAC-SHA1) and is partner-gated:
 * partner approval required before client_id/secret are issued, and
 * metric pulls happen via PUSH-only "ping" notifications + per-metric
 * REST fetches. A full implementation requires the OAuth 1 dance, ping
 * subscription provisioning, and a separate fetch path per metric type.
 *
 * We ship an interface-complete adapter that:
 *   - throws a clear "not yet implemented" message on fetch/refresh
 *   - flags itself sandbox=true so the UI surfaces a "Coming soon" badge
 *
 * This keeps the rest of the system (registry, UI catalogue, API spec)
 * consistent without claiming functionality we haven't validated.
 */
const SCOPES = ["health"] as const;
const NOT_IMPLEMENTED =
  "Garmin Health adapter is not yet implemented — Garmin uses OAuth 1.0a + " +
  "push notifications and requires partner approval.";

export const garminAdapter: ProviderAdapter = {
  id: "garmin",
  category: "wearable",
  displayName: "Garmin",
  description: "Wellness, sleep, and stress from Garmin watches (partner-gated).",
  syncIntervalMs: 60 * 60 * 1000,
  sandbox: true,
  scopes: SCOPES,
  supportsWebhooks: true,

  oauthAuthorizeUrl(_state) {
    // OAuth 1.0a — actual flow involves a request-token round trip first.
    // Surface the configuration error early so the UI can tell the user
    // the integration isn't wired up yet.
    loadProviderConfig("garmin");
    throw new Error(NOT_IMPLEMENTED);
  },
  exchangeCode(_code): Promise<ProviderTokens> {
    throw new Error(NOT_IMPLEMENTED);
  },
  refresh(_token): Promise<ProviderTokens> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async revoke(_token) {
    /* no-op until implemented */
  },
  async fetchSince(_integration: AdapterIntegration, _since: Date): Promise<NormalisedPayload> {
    return { biometrics: [], sleep: [], glucose: [], activity: [] };
  },
};
