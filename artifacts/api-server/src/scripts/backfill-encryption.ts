/**
 * Idempotent backfill for encrypted user fields.
 *
 * Populates `users.email_encrypted` and `users.email_lookup` for any row that
 * is missing them. On databases that still carry the legacy plaintext
 * `users.email` column, that value is the source. On databases where the
 * column has already been dropped (post migration 0003), the script becomes
 * an integrity probe and exits non-zero if any row is missing encrypted
 * values — that state requires manual recovery and must block migration 0003.
 *
 * MUST be run before applying migration 0003 on any database that still has
 * legacy plaintext rows. Running it after 0003 is safe and idempotent.
 *
 * Usage: pnpm --filter @workspace/api-server run backfill:encryption
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { encrypt, emailLookupHash } from "../lib/encryption";

interface LegacyRow {
  id: string;
  email: string | null;
}

async function plaintextColumnExists(): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'email'
     LIMIT 1
  `);
  return (r.rows?.length ?? 0) > 0;
}

async function backfillFromLegacy(): Promise<number> {
  const result = await db.execute(sql`
    SELECT id, email FROM users
     WHERE (email_encrypted IS NULL OR email_lookup IS NULL)
       AND email IS NOT NULL
  `);
  const rows = (result.rows ?? []) as unknown as LegacyRow[];
  let updated = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const normalized = row.email.trim().toLowerCase();
    const encrypted = encrypt(normalized);
    const lookup = emailLookupHash(normalized);
    await db.execute(sql`
      UPDATE users
         SET email_encrypted = ${encrypted},
             email_lookup    = ${lookup}
       WHERE id = ${row.id}
    `);
    updated += 1;
  }
  return updated;
}

async function countMissing(): Promise<number> {
  const r = await db.execute(sql`
    SELECT count(*)::int AS missing FROM users
     WHERE email_encrypted IS NULL OR email_lookup IS NULL
  `);
  return Number((r.rows as Array<{ missing: number }>)[0]?.missing ?? 0);
}

async function main(): Promise<void> {
  const hasLegacy = await plaintextColumnExists();
  if (hasLegacy) {
    const updated = await backfillFromLegacy();
    if (updated > 0) {
      console.log(
        `✅ Backfilled email_encrypted/email_lookup for ${updated} user(s) from legacy users.email column.`,
      );
    } else {
      console.log(
        "ℹ️  Legacy users.email column present but no rows required backfill.",
      );
    }
  } else {
    console.log(
      "ℹ️  Legacy users.email column already dropped — running integrity probe only.",
    );
  }

  const missing = await countMissing();
  if (missing > 0) {
    console.error(
      `❌ ${missing} user row(s) still missing email_encrypted/email_lookup. ` +
        (hasLegacy
          ? "Some rows had no plaintext value to backfill from — manual recovery required before applying migration 0003."
          : "Plaintext email column has already been dropped — manual recovery required."),
    );
    process.exit(2);
  }

  console.log("✅ All user rows have encrypted email + lookup hash.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
