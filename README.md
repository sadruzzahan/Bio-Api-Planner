# Bio-Api-Planner (BioOS)

**One-liner:** A pnpm monorepo delivering **BioOS** — a Clerk-authenticated wellness web app and Express API for biometrics, sleep, glucose, activity, meals, supplements, wearable integrations, and an AI chat assistant — backed by PostgreSQL and Drizzle.

## What it does

The main product is **`artifacts/biological-api`**: a React (Vite) SPA with sign-in, onboarding, dashboard, and pages for biometrics, sleep, glucose, activity, interventions, supplements, integrations, chat, and profile (privacy export, delete, consent, audit log). Legal flows (terms, privacy, disclaimer), cookie consent, and post-sign-in consent gating are implemented in the UI.

The **`artifacts/api-server`** Express 5 service exposes a versioned REST API under `/api`, enforces Clerk sessions, records compliance consent, encrypts sensitive fields, writes an audit log, proxies the Clerk frontend API at `/api/__clerk`, and accepts provider webhooks at `/api/webhooks/:provider`. Scheduled jobs (for example soft-delete purges) run with the server.

**`artifacts/mockup-sandbox`** is an additional Vite/React sandbox UI in the workspace.

Shared libraries under **`lib/`** include the database schema and migrations (`@workspace/db`), OpenAPI spec and Orval-generated Zod + React Query client (`@workspace/api-spec`, `@workspace/api-zod`, `@workspace/api-client-react`), OAuth integrations for WHOOP, Oura, Fitbit, and Dexcom (`@workspace/integrations`), and Anthropic-backed AI integration helpers (`@workspace/integrations-anthropic-ai`).

The product is framed as **informational / non-medical**; `replit.md` documents GDPR/CCPA-oriented compliance features (encryption, audit, export, delete).

## Tech stack

| Area | Choice |
|------|--------|
| Monorepo | pnpm workspaces |
| Language | TypeScript ~5.9 |
| API | Express 5, Pino, CORS, esbuild bundle |
| Auth | Clerk (`@clerk/express`, `@clerk/react`), Clerk proxy middleware |
| Database | PostgreSQL, Drizzle ORM, SQL migrations |
| Validation / API codegen | Zod, Orval from `lib/api-spec/openapi.yaml` |
| Frontend | React 19, Vite 7, Wouter, TanStack Query, Tailwind 4, Radix UI |
| AI | Anthropic via `AI_INTEGRATIONS_*` env (integration package) |

## Project structure

```
.
├── artifacts/
│   ├── api-server/          # Express API (entry: src/index.ts, app: src/app.ts)
│   ├── biological-api/      # Main BioOS Vite + React app
│   └── mockup-sandbox/      # Secondary Vite sandbox
├── lib/
│   ├── api-spec/            # openapi.yaml + codegen
│   ├── api-zod/             # Generated Zod types
│   ├── api-client-react/    # Generated hooks + customFetch
│   ├── db/                  # Drizzle schema, migrations, drizzle.config.ts
│   ├── integrations/        # OAuth providers + ingest
│   └── integrations-anthropic-ai/
├── scripts/                 # Workspace scripts package
├── package.json             # Root scripts (typecheck, build)
├── pnpm-workspace.yaml
└── replit.md                # Workspace + compliance notes
```

## Setup

**Prerequisites:** Node.js 24+, [pnpm](https://pnpm.io/), PostgreSQL.

```bash
pnpm install
```

Apply database schema (development; see `@workspace/db` scripts):

```bash
pnpm --filter @workspace/db run push
```

Regenerate API client from OpenAPI (when the spec changes):

```bash
pnpm --filter @workspace/api-spec run codegen
```

Root quality gates:

```bash
pnpm run typecheck
pnpm run build
```

## Environment variables

Values below are read from **server** code unless noted as **Vite (client)**.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes (api-server) | TCP port the API listens on. |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Drizzle and the API. |
| `APP_ENCRYPTION_KEY` | Yes | 32-byte base64 key: AES-256-GCM for emails/integration secrets and OAuth state (see `replit.md`). |
| `CLERK_SECRET_KEY` | Yes (non-prod proxy behavior) | Clerk secret; used by Clerk proxy middleware in development. |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for `clerkMiddleware` host mapping. |
| `OAUTH_REDIRECT_BASE` | For integrations | Public origin for OAuth callbacks (e.g. `https://your-api-host`). Falls back to `PUBLIC_APP_URL` or Replit `REPLIT_DEV_DOMAIN`. |
| `PUBLIC_APP_URL` | Optional | Alternate public base URL for OAuth redirect resolution. |
| `REPLIT_DEV_DOMAIN` | Optional (Replit) | Sets `https://<domain>` as OAuth base when other bases unset. |
| `WHOOP_CLIENT_ID` | Per provider | OAuth client ID for WHOOP. |
| `WHOOP_CLIENT_SECRET` | Per provider | OAuth client secret for WHOOP. |
| `WHOOP_SANDBOX` | Optional | `"true"` / `"1"` for sandbox mode. |
| `OURA_CLIENT_ID` | Per provider | OAuth client ID for Oura. |
| `OURA_CLIENT_SECRET` | Per provider | OAuth client secret for Oura. |
| `OURA_SANDBOX` | Optional | `"true"` / `"1"` for sandbox mode. |
| `FITBIT_CLIENT_ID` | Per provider | OAuth client ID for Fitbit. |
| `FITBIT_CLIENT_SECRET` | Per provider | OAuth client secret for Fitbit. |
| `FITBIT_SANDBOX` | Optional | `"true"` / `"1"` for sandbox mode. |
| `DEXCOM_CLIENT_ID` | Per provider | OAuth client ID for Dexcom. |
| `DEXCOM_CLIENT_SECRET` | Per provider | OAuth client secret for Dexcom. |
| `DEXCOM_SANDBOX` | Optional | In OAuth config: defaults to sandbox unless `"false"` / `"0"`. Also read in the Dexcom provider for API base selection. |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | For AI chat | Anthropic API base URL. |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | For AI chat | Anthropic API key. |
| `LOG_LEVEL` | Optional | Pino log level (default `info`). |
| `NODE_ENV` | Optional | `production` vs development behavior (Clerk proxy, Vite plugins). |

**Vite — `artifacts/biological-api` (and sandbox):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for the SPA. |
| `VITE_CLERK_PROXY_URL` | Optional | URL of the Clerk frontend API proxy (e.g. `/api/__clerk` on the API host). |
| `PORT` | Optional | Dev server port (Vite config). |
| `BASE_PATH` | Optional | Base path for deployed subpaths. |
| `REPL_ID` | Optional (Replit) | Enables Replit-specific Vite plugins when set. |

Standard Vite `import.meta.env.BASE_URL` is used for routing and asset paths (not a custom env key).

## How to run

**API server** (from repo root; set `PORT`, `DATABASE_URL`, Clerk, `APP_ENCRYPTION_KEY`, etc. first):

```bash
pnpm --filter @workspace/api-server run dev
```

**BioOS web app:**

```bash
pnpm --filter @workspace/biological-api run dev
```

The SPA calls `/api/...` relative to its origin — in production, serve the API and frontend so those paths reach the Express app (or use a reverse proxy).

**Mockup sandbox:**

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

## Features (from code)

- Clerk sign-in/sign-up with proxy-friendly publishable key resolution.
- Onboarding gate until `onboardedAt` is set on the user record.
- Dashboard, biometrics (list, create, summary), sleep and trends, glucose and trends, activity, interventions, meals, supplements.
- Wearable **OAuth**: WHOOP, Oura, Fitbit, Dexcom — authorize URL, callback, disconnect, sync, run history; **webhooks** for providers that push.
- **Insights** and **chat** (Anthropic-backed when AI env is set).
- **Compliance**: consent CRUD, audit log read, full **export** (ZIP), **soft delete** with scheduled hard delete; security headers and encryption at application layer.

## HTTP API (Express, base path `/api`)

All routes below are prefixed with `/api` (example: `GET /api/healthz`). Authenticated routes expect a Clerk session unless noted.

**Public**

- `GET /healthz`, `GET /health` — health check.
- `POST /webhooks/:provider` — provider webhooks (raw body; HMAC verified per provider).

**Auth required; some routes allowed before consent** (see `routes/index.ts`)

- `GET /consent`, `POST /consent` — consent records.
- `GET /users/me` — current user (read-only pre-consent).
- `GET /audit/log` — audit entries.
- `GET /users/me/export` — data export.
- `DELETE /users/me` — account deletion request.

**After consent**

- `PATCH /users/me`
- `GET|POST /biometrics`, `GET /biometrics/summary`
- `GET /sleep`, `GET /sleep/trend`
- `GET /glucose`, `GET /glucose/trend`
- `GET /activity`
- `GET /state/current`, `GET /state/history`
- `GET /interventions`, `PATCH /interventions/:id`
- `GET /meals`, `POST /meals`
- `GET|POST|PATCH|DELETE /supplements` (and by id)
- `GET /integrations`, `GET /integrations/:provider/authorize-url`, `GET /integrations/:provider/callback`, `DELETE /integrations/:provider`, `POST /integrations/:id/sync`, `GET /integrations/:id/runs`
- `GET /dashboard`
- `GET /insights`
- `POST /chat`, `GET /chat/history`

**Clerk proxy (not under generic router prefix in docs):** `GET/POST ...` — mounted at `/api/__clerk` in `app.ts`.

The authoritative contract is **`lib/api-spec/openapi.yaml`**.

## Scripts (api-server package)

- `pnpm --filter @workspace/api-server run seed` — seed script
- `backfill:encryption`, `backfill:integration-secrets` — maintenance scripts
- `test:deletion`, `test:consent-gate` — integrity/consent tests

---

License: MIT (root `package.json`).
