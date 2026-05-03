/**
 * One-shot backfill that historically populated `users.email_encrypted` /
 * `users.email_lookup` from the now-removed plaintext `users.email` column.
 *
 * After migration 0003 dropped that column, the script keeps the same
 * invocation surface but acts as an integrity probe: it asserts every row
 * already carries the encrypted + lookup columns and exits non-zero
 * otherwise. This keeps the deploy pipeline honest if a future migration
 * is misordered.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  const missing = await db.execute(sql`
    SELECT count(*)::int AS missing FROM users
     WHERE email_encrypted IS NULL OR email_lookup IS NULL
  `);
  const n = Number((missing.rows as Array<{ missing: number }>)[0]?.missing ?? 0);
  if (n > 0) {
    console.error(
      `❌ ${n} user(s) missing email_encrypted/email_lookup. ` +
        `Plaintext email column has already been dropped — manual recovery required.`,
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
