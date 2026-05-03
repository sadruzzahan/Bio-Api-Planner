-- Discovered via test-deletion-integrity.ts: the consent_records and
-- audit_log tables were originally created by an earlier `drizzle-kit push`
-- (which ignored the schema-defined FK clauses) and migration 0002's
-- CREATE TABLE IF NOT EXISTS no-oped against them. Result: a hard delete
-- of a user left orphan rows in both tables, breaking GDPR Art. 17.
--
-- This migration retroactively installs the FK constraints declared in
-- the schema:
--   * consent_records.user_id -> users(id) ON DELETE CASCADE
--   * audit_log.user_id        -> users(id) ON DELETE SET NULL
--   * audit_log.actor_id       -> users(id) ON DELETE SET NULL
--
-- Idempotent — guards each constraint with a pg_constraint lookup.

BEGIN;

-- Clean any existing orphans before we add the constraint, otherwise
-- ALTER TABLE ADD CONSTRAINT will refuse with a validation error.
DELETE FROM consent_records cr
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cr.user_id);
UPDATE audit_log SET user_id  = NULL
 WHERE user_id  IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = audit_log.user_id);
UPDATE audit_log SET actor_id = NULL
 WHERE actor_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = audit_log.actor_id);

-- Detect equivalent FKs by structure (table + column + ref-target +
-- on-delete action), not just by constraint name. This prevents
-- duplicate semantic FKs being created on a fresh DB where drizzle-kit
-- generated a differently-named FK.
CREATE OR REPLACE FUNCTION pg_temp.fk_exists(
  p_table     text,
  p_column    text,
  p_ref_table text,
  p_on_delete char  -- 'c' = cascade, 'n' = set null, 'a' = no action
) RETURNS boolean LANGUAGE sql AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class      t   ON t.oid  = c.conrelid
      JOIN pg_class      rt  ON rt.oid = c.confrelid
      JOIN pg_attribute  a   ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute  ra  ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
     WHERE c.contype     = 'f'
       AND t.relname     = p_table
       AND rt.relname    = p_ref_table
       AND a.attname     = p_column
       AND ra.attname    = 'id'
       AND c.confdeltype = p_on_delete
       AND array_length(c.conkey, 1) = 1
  );
$fn$;

DO $$
BEGIN
  IF NOT pg_temp.fk_exists('consent_records', 'user_id', 'users', 'c') THEN
    ALTER TABLE consent_records
      ADD CONSTRAINT consent_records_user_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT pg_temp.fk_exists('audit_log', 'user_id', 'users', 'n') THEN
    ALTER TABLE audit_log
      ADD CONSTRAINT audit_log_user_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT pg_temp.fk_exists('audit_log', 'actor_id', 'users', 'n') THEN
    ALTER TABLE audit_log
      ADD CONSTRAINT audit_log_actor_id_fk
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
