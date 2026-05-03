-- Task #7 follow-up: enforce true field-level encryption for users.email.
-- The plaintext column was a transitional measure; with every row backfilled
-- via artifacts/api-server/src/scripts/backfill-encryption.ts, we now drop
-- it and promote the encrypted/lookup columns to NOT NULL.
--
-- Idempotent — safe to re-run.

BEGIN;

-- Belt-and-suspenders: ensure no row would be lost by tightening NOT NULL.
-- (The backfill should have populated everything; this is a defensive check
-- so the migration fails loudly instead of silently corrupting state.)
DO $$
DECLARE
  missing int;
BEGIN
  SELECT count(*) INTO missing FROM users
    WHERE email_encrypted IS NULL OR email_lookup IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop users.email: % row(s) missing email_encrypted/email_lookup. Run backfill-encryption.ts first.',
      missing;
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN email_encrypted SET NOT NULL,
  ALTER COLUMN email_lookup    SET NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS email;

COMMIT;
