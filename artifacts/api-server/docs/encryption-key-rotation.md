# `APP_ENCRYPTION_KEY` operational runbook

## What it protects
Application-layer AES-256-GCM encryption (see `src/lib/encryption.ts`) used
for:
- `users.email_encrypted`
- `users.email_lookup` (HMAC-SHA-256 keyed on the same key)
- string fields listed in `SECRET_INTEGRATION_FIELDS` inside
  `integrations.metadata` (e.g. `access_token`, `refresh_token`,
  `client_secret`)

## Storage
- **Production:** Replit Secret named `APP_ENCRYPTION_KEY`. Never commit to
  `.replit`, `git`, or any deploy artifact. The server refuses to start if
  the variable is unset (see `getKey()` in `encryption.ts`).
- **Development:** also a Replit Secret. Local dev must NOT rely on a
  hard-coded value — set the secret via the Replit UI or
  `request_env_var`.

## Format
32 bytes, encoded as either:
- 64-character hex, or
- 44-character base64 (e.g. `openssl rand -base64 32`).

## Generating a fresh key
```sh
openssl rand -base64 32
```

## Rotation procedure
Encrypted ciphertext is prefixed with a `v1:` version tag (see
`encrypt()` in `encryption.ts`). To rotate:

1. **Generate a new key** with `openssl rand -base64 32`.
2. **Stage the old key** somewhere accessible to the rotation script
   (e.g. a temporary `APP_ENCRYPTION_KEY_PREVIOUS` Replit Secret).
3. **Re-encrypt every protected column.** A future rotation script
   should iterate `users` and `integrations` rows, call `decrypt()`
   under the OLD key, and `encrypt()` under the NEW key. The current
   `encrypt()`/`decrypt()` helpers read `APP_ENCRYPTION_KEY` once at
   process start, so the rotation script must be invoked with the OLD
   key for the read pass and the NEW key for the write pass — or
   refactored to take an explicit key parameter for the migration
   window.
4. **Re-derive `users.email_lookup`.** The lookup column is an HMAC
   of the email keyed on `APP_ENCRYPTION_KEY`; rotating the key makes
   every existing lookup hash invalid. The rotation script must
   `emailLookupHash(decryptedEmail)` under the NEW key for every user
   in the same transaction it writes the new ciphertext.
5. **Promote the NEW key** to `APP_ENCRYPTION_KEY` and remove
   `APP_ENCRYPTION_KEY_PREVIOUS`.
6. **Bump the ciphertext version prefix** (e.g. to `v2:`) in
   `encryption.ts` so any leftover `v1:` row would surface as a clear
   decryption failure rather than silent corruption.

## Recovery from key loss
If `APP_ENCRYPTION_KEY` is lost and no backup exists, encrypted columns
are unrecoverable. Mitigations:
- Keep a sealed offline copy of the production key.
- Snapshot the Replit Secret value to your password manager whenever
  it is rotated.
- The `users.email_lookup` column is also keyed on this value — losing
  the key breaks email-based account lookup as well.

## Reference scripts
- `pnpm --filter @workspace/api-server run backfill:encryption` —
  populates encrypted/lookup columns for any user row missing them.
  Idempotent; safe to run repeatedly. Acts as an integrity probe
  after migration 0003 has dropped the legacy plaintext column.
- `pnpm --filter @workspace/api-server run backfill:integration-secrets` —
  encrypts any plaintext token-like fields still present in
  `integrations.metadata`. Idempotent; skips values that already
  carry the `v1:` ciphertext prefix.
