import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { encrypt, emailLookupHash } from "../lib/encryption";

async function main() {
  const rows = await db.execute(sql`
    SELECT id, email FROM users
     WHERE email_lookup IS NULL OR email_encrypted IS NULL
  `);
  let n = 0;
  for (const r of rows.rows as Array<{ id: number; email: string }>) {
    await db.execute(sql`
      UPDATE users
         SET email_encrypted = ${encrypt(r.email)},
             email_lookup    = ${emailLookupHash(r.email)}
       WHERE id = ${r.id}`);
    n++;
  }
  console.log(`Backfilled ${n} user(s) with encrypted email + lookup hash.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
