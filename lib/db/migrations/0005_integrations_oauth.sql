-- Task #8 — Real wearable & CGM integrations.
--
-- Extends the placeholder integrations table with the columns required to
-- store OAuth state (encrypted tokens, scopes, expiry, external id, sync
-- bookkeeping), creates the sync_runs observability table, and installs
-- natural-key unique indexes on the four ingestion tables so that
-- repeated provider polls can use INSERT ... ON CONFLICT DO NOTHING.
--
-- Idempotent: every ALTER guards on a column-existence lookup and every
-- CREATE uses IF NOT EXISTS. Safe to re-run.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. integrations: add OAuth columns
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'access_token_encrypted', 'refresh_token_encrypted',
    'external_user_id', 'last_error'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS %I text',
      c
    );
  END LOOP;
END $$;

ALTER TABLE integrations ADD COLUMN IF NOT EXISTS scopes            text[];
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS token_expires_at  timestamptz;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_sync_at      timestamptz;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS next_sync_at      timestamptz;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS disconnected_at   timestamptz;

CREATE INDEX IF NOT EXISTS integrations_user_provider_idx
  ON integrations (user_id, provider);
CREATE INDEX IF NOT EXISTS integrations_next_sync_idx
  ON integrations (next_sync_at);

-- A user can only have one row per provider. Existing duplicates (from the
-- old placeholder code) are coalesced first by keeping the row with the
-- highest id (most recently inserted).
DELETE FROM integrations a
 USING integrations b
 WHERE a.user_id  = b.user_id
   AND a.provider = b.provider
   AND a.id       < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS integrations_user_provider_uq
  ON integrations (user_id, provider);

-- ----------------------------------------------------------------------------
-- 2. sync_runs: observability table for every provider poll
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
  id                serial PRIMARY KEY,
  integration_id    integer NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  trigger           text NOT NULL DEFAULT 'scheduled',
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  status            text NOT NULL DEFAULT 'running',
  records_ingested  integer NOT NULL DEFAULT 0,
  error             text
);
CREATE INDEX IF NOT EXISTS sync_runs_integration_started_idx
  ON sync_runs (integration_id, started_at);

-- ----------------------------------------------------------------------------
-- 3. Natural-key uniqueness on ingestion tables (idempotent ingest)
-- ----------------------------------------------------------------------------
-- biometric_readings: (user_id, source, metric, recorded_at)
DELETE FROM biometric_readings a
 USING biometric_readings b
 WHERE a.user_id     = b.user_id
   AND a.source      = b.source
   AND a.metric      = b.metric
   AND a.recorded_at = b.recorded_at
   AND a.id          < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS biometric_natural_key_uq
  ON biometric_readings (user_id, source, metric, recorded_at);

-- sleep_sessions: (user_id, source, date) — at most one nightly summary per source
DELETE FROM sleep_sessions a
 USING sleep_sessions b
 WHERE a.user_id = b.user_id
   AND a.source  = b.source
   AND a.date    = b.date
   AND a.id      < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS sleep_natural_key_uq
  ON sleep_sessions (user_id, source, date);

-- glucose_readings: (user_id, source, recorded_at)
DELETE FROM glucose_readings a
 USING glucose_readings b
 WHERE a.user_id     = b.user_id
   AND a.source      = b.source
   AND a.recorded_at = b.recorded_at
   AND a.id          < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS glucose_natural_key_uq
  ON glucose_readings (user_id, source, recorded_at);

-- activity_sessions: (user_id, source, type, recorded_at)
DELETE FROM activity_sessions a
 USING activity_sessions b
 WHERE a.user_id     = b.user_id
   AND a.source      = b.source
   AND a.type        = b.type
   AND a.recorded_at = b.recorded_at
   AND a.id          < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS activity_natural_key_uq
  ON activity_sessions (user_id, source, type, recorded_at);

COMMIT;
