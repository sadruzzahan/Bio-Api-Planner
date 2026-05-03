# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## BioOS — Compliance, privacy & legal

The `artifacts/biological-api` product handles sensitive health data and is
built to a production-compliance bar (GDPR / CCPA / state-privacy informed,
non-HIPAA — BioOS is explicitly informational and not a medical device).

### Required secrets

- `APP_ENCRYPTION_KEY` — 32-byte base64 key used for AES-256-GCM
  application-layer encryption of email addresses and integration OAuth
  tokens, and as the seed for the deterministic HMAC-SHA-256 used to look up
  users by email (`email_lookup`). Must be set in **all** environments;
  rotating requires re-encrypting `users.email_encrypted` and integration
  tokens via `artifacts/api-server/src/scripts/backfill-encryption.ts`.

### Server-side guarantees

- **Encryption at rest**: `lib/encryption.ts` (AES-256-GCM v1, format
  `v1:iv:tag:ciphertext`). Encrypted columns: `users.email_encrypted`,
  `integrations.metadata.{accessToken,refreshToken,apiKey,clientSecret,…}`
  (`SECRET_INTEGRATION_FIELDS`).
- **Audit log**: append-only `audit_log` table — `UPDATE` / `DELETE`
  privileges revoked at the role level. Every write endpoint records an
  entry via `lib/audit.ts` (`recordAudit` is non-throwing).
- **Security headers**: `middlewares/securityHeaders.ts` adds
  `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Permissions-Policy`, and a strict `Cross-Origin-Resource-Policy`. Mounted
  before the Clerk proxy in `app.ts`.
- **Cascade deletes** on every user-owned table; **soft delete** via
  `users.deleted_at` + `deletion_requested_at`. `lib/scheduledJobs.ts` runs
  `purgeDeletedUsers` every 24 hours and hard-deletes accounts past the
  30-day grace window (also `clerkClient.users.deleteUser`).

### Compliance endpoints

| Method | Path                | Purpose |
| ------ | ------------------- | ------- |
| GET    | `/consent`          | List the current user's consent records. |
| POST   | `/consent`          | Record acceptance/revocation of a legal document version. |
| GET    | `/audit/log`        | Last 100 audit entries for the current user. |
| GET    | `/users/me/export`  | Sync JSON archive of every row owned by the user (decrypted secrets included). |
| DELETE | `/users/me`         | Soft-delete the account; revokes all Clerk sessions; purge after 30 days. |

### Frontend gates

- `pages/legal/{terms,privacy,disclaimer}.tsx` — public legal pages, version
  pinned via `lib/legal.ts` (`LEGAL_VERSIONS`).
- `components/cookie-consent-banner.tsx` — first-load banner, persists choice
  to `localStorage` and POSTs `/consent` with `document=cookies` when signed
  in.
- `components/post-signin-consent-modal.tsx` — blocks the app shell until the
  current versions of ToS, Privacy and Medical Disclaimer are accepted.
  Declining signs the operator out.
- `components/medical-disclaimer.tsx` — non-removable pill on every assistant
  message + first-session banner above the chat composer.
- `pages/profile.tsx` → **Privacy & data** tab — export, delete (type-email
  confirm), consent history, audit log viewer.
- `pages/landing.tsx` — footer surfaces all three legal links plus a
  permanent informational disclaimer.

### Bumping legal-document versions

1. Update the version constant in `artifacts/biological-api/src/lib/legal.ts`
   and `EFFECTIVE_DATE`.
2. Edit the corresponding `components/legal/*-content.tsx` body.
3. Existing operators are automatically re-prompted on next sign-in by
   `PostSigninConsentModal`.
