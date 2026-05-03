-- Task #7: Compliance, privacy & legal.
-- Idempotent — safe to re-run.
--
-- Adds:
--   * users.email_encrypted, users.email_lookup, users.deleted_at,
--     users.deletion_requested_at
--   * consent_records, audit_log tables
--   * ON DELETE CASCADE on every user-owned table so a hard purge cleanly
--     removes all of a user's rows in one statement.

BEGIN;

-- ---- users ------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_encrypted        text,
  ADD COLUMN IF NOT EXISTS email_lookup           text,
  ADD COLUMN IF NOT EXISTS deleted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_at  timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lookup_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_lookup_unique UNIQUE (email_lookup);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);

-- ---- compliance tables ------------------------------------------------------

CREATE TABLE IF NOT EXISTS consent_records (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document    text    NOT NULL,
  version     text    NOT NULL,
  accepted    boolean NOT NULL DEFAULT true,
  categories  jsonb,
  ip          text,
  user_agent  text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_user_doc_idx ON consent_records (user_id, document);

CREATE TABLE IF NOT EXISTS audit_log (
  id          serial PRIMARY KEY,
  user_id     integer REFERENCES users(id) ON DELETE SET NULL,
  actor_id    integer REFERENCES users(id) ON DELETE SET NULL,
  action      text    NOT NULL,
  entity      text    NOT NULL,
  entity_id   text,
  metadata    jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_user_created_idx ON audit_log (user_id, created_at);

-- Defensive: revoke UPDATE/DELETE on audit_log from the application role.
-- (No-op when the role has the default `BYPASSRLS`/superuser-equivalent grants
-- in development, but documents intent for production rollout.)
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ---- cascade deletes on user-owned tables -----------------------------------
-- Drop & recreate each FK with ON DELETE CASCADE so DELETE FROM users
-- transitively removes all owned rows in a single statement.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname, conrelid::regclass::text AS tbl
      FROM pg_constraint
     WHERE confrelid = 'users'::regclass
       AND contype   = 'f'
       AND conname   <> 'consent_records_user_id_users_id_fk'
       AND conname   <> 'audit_log_user_id_users_id_fk'
       AND conname   <> 'audit_log_actor_id_users_id_fk'
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      rec.tbl, rec.conname
    );
  END LOOP;
END $$;

ALTER TABLE biometric_readings  ADD CONSTRAINT biometric_readings_user_id_fk  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE sleep_sessions      ADD CONSTRAINT sleep_sessions_user_id_fk      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE glucose_readings    ADD CONSTRAINT glucose_readings_user_id_fk    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE activity_sessions   ADD CONSTRAINT activity_sessions_user_id_fk   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE biological_states   ADD CONSTRAINT biological_states_user_id_fk   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE interventions       ADD CONSTRAINT interventions_user_id_fk       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE meals               ADD CONSTRAINT meals_user_id_fk               FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE supplements         ADD CONSTRAINT supplements_user_id_fk         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_messages       ADD CONSTRAINT chat_messages_user_id_fk       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE integrations        ADD CONSTRAINT integrations_user_id_fk        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
