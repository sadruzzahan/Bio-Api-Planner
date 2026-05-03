import type { ProviderAdapter, ProviderConfig, ProviderId } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { whoopAdapter } from "./providers/whoop";
import { ouraAdapter } from "./providers/oura";
import { fitbitAdapter } from "./providers/fitbit";
import { dexcomAdapter } from "./providers/dexcom";

// Garmin Health is not registered here — it requires partner approval and
// uses OAuth 1.0a, which is tracked as a follow-up. Do not add a stub
// adapter to this map; only providers we can actually authenticate today
// belong here so the UI never advertises a connection it can't deliver.
const adapters: Record<ProviderId, ProviderAdapter> = {
  whoop: whoopAdapter,
  oura: ouraAdapter,
  fitbit: fitbitAdapter,
  dexcom: dexcomAdapter,
};

export function listAdapters(): ProviderAdapter[] {
  return Object.values(adapters);
}

export function getAdapter(provider: string): ProviderAdapter {
  const a = adapters[provider as ProviderId];
  if (!a) throw new Error(`Unknown provider: ${provider}`);
  return a;
}

/**
 * Resolve a provider's OAuth configuration from environment variables.
 * Convention:
 *   <PROVIDER>_CLIENT_ID
 *   <PROVIDER>_CLIENT_SECRET
 *   <PROVIDER>_SANDBOX   ("true" / "1" — defaults to false except Dexcom)
 *   OAUTH_REDIRECT_BASE  (e.g. https://app.example.com — required)
 *
 * Throws ProviderNotConfiguredError when any required value is missing.
 * Callers (the OAuth route) should catch and surface a helpful 503 to the
 * UI so the integrations page can render a "Not configured" badge instead
 * of breaking entirely.
 */
export function loadProviderConfig(provider: ProviderId): ProviderConfig {
  const upper = provider.toUpperCase();
  const clientId = process.env[`${upper}_CLIENT_ID`];
  const clientSecret = process.env[`${upper}_CLIENT_SECRET`];
  if (!clientId) throw new ProviderNotConfiguredError(provider, `${upper}_CLIENT_ID`);
  if (!clientSecret) throw new ProviderNotConfiguredError(provider, `${upper}_CLIENT_SECRET`);

  const base =
    process.env.OAUTH_REDIRECT_BASE ??
    process.env.PUBLIC_APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined);
  if (!base) {
    throw new ProviderNotConfiguredError(provider, "OAUTH_REDIRECT_BASE");
  }
  // The redirect URI MUST exactly match what's registered with each
  // provider — see docs/oauth-redirect-uris.md.
  const redirectUri = `${base.replace(/\/$/, "")}/api/integrations/${provider}/callback`;

  const sandboxEnv = process.env[`${upper}_SANDBOX`];
  const sandbox =
    sandboxEnv === "true" ||
    sandboxEnv === "1" ||
    (provider === "dexcom" && sandboxEnv !== "false" && sandboxEnv !== "0");

  return { clientId, clientSecret, redirectUri, sandbox };
}

export function isProviderConfigured(provider: ProviderId): boolean {
  try {
    loadProviderConfig(provider);
    return true;
  } catch {
    return false;
  }
}
