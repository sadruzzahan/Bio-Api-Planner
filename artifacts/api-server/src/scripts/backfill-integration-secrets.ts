/**
 * Idempotent backfill that encrypts secret-bearing string fields inside
 * `integrations.metadata` for any row stored before field-level encryption
 * was applied on the connect/update paths.
 *
 * Walks every row and, for each key in SECRET_INTEGRATION_FIELDS, encrypts
 * its string value in place — UNLESS the value already carries the `v1:`
 * ciphertext prefix (meaning it was already encrypted on a prior run).
 *
 * Safe to re-run; rows with no secret fields or only-already-encrypted
 * values are skipped without a write.
 *
 * Usage: pnpm --filter @workspace/api-server run backfill:integration-secrets
 */
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, SECRET_INTEGRATION_FIELDS } from "../lib/encryption";

const CIPHERTEXT_PREFIX = "v1:";

async function main(): Promise<void> {
  const rows = await db
    .select({ id: integrationsTable.id, metadata: integrationsTable.metadata })
    .from(integrationsTable);

  let scanned = 0;
  let updated = 0;
  let alreadyEncrypted = 0;

  for (const row of rows) {
    scanned += 1;
    const metadata = row.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      continue;
    }
    const obj = metadata as Record<string, unknown>;
    let mutated = false;
    const next: Record<string, unknown> = { ...obj };
    for (const field of SECRET_INTEGRATION_FIELDS) {
      const v = next[field];
      if (typeof v !== "string" || v.length === 0) continue;
      if (v.startsWith(CIPHERTEXT_PREFIX)) {
        alreadyEncrypted += 1;
        continue;
      }
      next[field] = encrypt(v);
      mutated = true;
    }
    if (mutated) {
      await db
        .update(integrationsTable)
        .set({ metadata: next })
        .where(eq(integrationsTable.id, row.id));
      updated += 1;
    }
  }

  console.log(
    `✅ Integration-secret backfill complete. scanned=${scanned} updated=${updated} alreadyEncryptedFields=${alreadyEncrypted}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
