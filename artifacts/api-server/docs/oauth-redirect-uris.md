# Wearable & CGM OAuth — Redirect URI Reference

This document is the source of truth for the redirect URIs you must
register with each provider's developer console. The application
constructs them from a single base:

```
{OAUTH_REDIRECT_BASE}/api/integrations/{provider}/callback
```

Set `OAUTH_REDIRECT_BASE` to the **public** origin of the deployed app —
in development that is `https://${REPLIT_DEV_DOMAIN}`, in production it
is your custom domain. The path suffix is fixed and identical across
providers; only the provider slug changes.

## Required Replit Secrets

Before connecting a provider, set these Replit Secrets (Settings → Secrets):

| Provider | Required secrets                                                                 | Notes                                                                           |
|----------|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Whoop    | `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`                                         | Apply via developer.whoop.com. Webhook secret = client secret.                  |
| Oura     | `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`                                           | cloud.ouraring.com → Developer → OAuth2.                                        |
| Fitbit   | `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`                                       | dev.fitbit.com. Use **server** OAuth (confidential client).                     |
| Dexcom   | `DEXCOM_CLIENT_ID`, `DEXCOM_CLIENT_SECRET`, optional `DEXCOM_SANDBOX=false`      | Defaults to sandbox (`sandbox-api.dexcom.com`) until partner approval.          |

> Garmin Health is intentionally not registered yet — it is partner-gated
> and uses OAuth 1.0a, which is tracked as a follow-up. The catalogue
> only advertises providers we can actually authenticate today.

If a secret is missing, the corresponding integration card shows a
"Not configured" badge in the UI and `/integrations/:provider/authorize-url`
returns HTTP 503 with `{ error, provider, missing }`.

## Redirect URIs to register

Replace `{OAUTH_REDIRECT_BASE}` with your actual public origin (no trailing slash):

```
{OAUTH_REDIRECT_BASE}/api/integrations/whoop/callback
{OAUTH_REDIRECT_BASE}/api/integrations/oura/callback
{OAUTH_REDIRECT_BASE}/api/integrations/fitbit/callback
{OAUTH_REDIRECT_BASE}/api/integrations/dexcom/callback
```

Most provider consoles allow multiple redirect URIs — register both
your dev (`https://<dev-domain>/...`) and production
(`https://app.example.com/...`) variants up front.

## Webhook URLs

Providers that push events deliver to a separate, **public** path:

```
{OAUTH_REDIRECT_BASE}/api/webhooks/whoop
{OAUTH_REDIRECT_BASE}/api/webhooks/fitbit
{OAUTH_REDIRECT_BASE}/api/webhooks/dexcom
```

These endpoints sit outside the Clerk-auth middleware. Each adapter
verifies an HMAC signature against the raw request body before
triggering a sync, so incoming POSTs without a valid signature are
rejected with 401.

## Verifying configuration

```bash
curl -i "$OAUTH_REDIRECT_BASE/api/healthz"   # expects 200
curl -i -H "Cookie: <clerk session>" \
     "$OAUTH_REDIRECT_BASE/api/integrations" # expects 200, lists every provider
```

The list response includes `configured: true|false` per provider so the
UI can decide whether to enable the Connect button without ever shipping
secrets to the client.
