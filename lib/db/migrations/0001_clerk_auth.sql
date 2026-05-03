-- Task #6: Replace demo user with real Clerk-backed auth.
--
-- This migration is idempotent — safe to re-run on databases where the
-- schema-push already applied some of these statements.
--
-- 1. Add clerk_id (initially nullable so backfill can run), role, and
--    flip the tier default from 'demo' to 'basic'.
-- 2. Backfill existing rows: the seeded demo operator gets the sentinel
--    '__demo_seed__'; any other legacy row gets '__legacy_<id>'.
-- 3. Promote clerk_id to NOT NULL + UNIQUE.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS clerk_id text,
  ADD COLUMN IF NOT EXISTS role     text NOT NULL DEFAULT 'user';

ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'basic';

UPDATE users
   SET clerk_id = '__demo_seed__'
 WHERE clerk_id IS NULL
   AND email = 'alex@biohack.io';

UPDATE users
   SET clerk_id = '__legacy_' || id::text
 WHERE clerk_id IS NULL;

ALTER TABLE users ALTER COLUMN clerk_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'users_clerk_id_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id);
  END IF;
END $$;

COMMIT;
