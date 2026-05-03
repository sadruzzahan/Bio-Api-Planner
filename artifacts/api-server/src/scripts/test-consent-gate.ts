/**
 * Integration test for the server-side consent gate.
 *
 * Exercises the same query the requireConsent middleware uses against a
 * real DB row: a freshly-created user MUST be blocked, and recording
 * acceptance for every required document MUST unblock them. Run via
 * `pnpm --filter @workspace/api-server run test:consent-gate`.
 */
import { db, usersTable, consentRecordsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { encrypt, emailLookupHash } from "../lib/encryption";
import { REQUIRED_CONSENT_DOCS } from "../middlewares/requireConsent";

async function userHasAllRequiredConsent(userId: number): Promise<boolean> {
  const docs = REQUIRED_CONSENT_DOCS.map((d) => d.document);
  const rows = await db
    .select({
      document: consentRecordsTable.document,
      version: consentRecordsTable.version,
      accepted: consentRecordsTable.accepted,
    })
    .from(consentRecordsTable)
    .where(
      and(
        eq(consentRecordsTable.userId, userId),
        inArray(consentRecordsTable.document, docs),
      ),
    );
  for (const required of REQUIRED_CONSENT_DOCS) {
    const ok = rows.some(
      (r) =>
        r.document === required.document &&
        r.version === required.version &&
        r.accepted === true,
    );
    if (!ok) return false;
  }
  return true;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`❌ ${msg}`);
  console.log(`✅ ${msg}`);
}

async function main(): Promise<void> {
  const tag = `consent-test-${Date.now()}`;
  const email = `${tag}@example.test`;

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId: tag,
      emailEncrypted: encrypt(email),
      emailLookup: emailLookupHash(email),
      name: "Consent Gate Test",
      role: "user",
    })
    .returning({ id: usersTable.id });
  if (!user) throw new Error("failed to insert user");

  try {
    // 1. Brand-new user has no consent rows → must be blocked.
    assert(
      (await userHasAllRequiredConsent(user.id)) === false,
      "fresh user without consent is blocked by the gate",
    );

    // 2. Record N-1 of the required docs → still blocked.
    const partial = REQUIRED_CONSENT_DOCS.slice(0, -1);
    for (const d of partial) {
      await db.insert(consentRecordsTable).values({
        userId: user.id,
        document: d.document,
        version: d.version,
        accepted: true,
      });
    }
    assert(
      (await userHasAllRequiredConsent(user.id)) === false,
      "user with only partial consent is still blocked",
    );

    // 3. Record the final required doc → must unblock.
    const last = REQUIRED_CONSENT_DOCS[REQUIRED_CONSENT_DOCS.length - 1]!;
    await db.insert(consentRecordsTable).values({
      userId: user.id,
      document: last.document,
      version: last.version,
      accepted: true,
    });
    assert(
      (await userHasAllRequiredConsent(user.id)) === true,
      "user with all required consent passes the gate",
    );

    // 4. A consent row at the wrong version must NOT count.
    await db.delete(consentRecordsTable).where(eq(consentRecordsTable.userId, user.id));
    for (const d of REQUIRED_CONSENT_DOCS) {
      await db.insert(consentRecordsTable).values({
        userId: user.id,
        document: d.document,
        version: "0.0-stale",
        accepted: true,
      });
    }
    assert(
      (await userHasAllRequiredConsent(user.id)) === false,
      "stale-version consent rows do NOT satisfy the gate",
    );

    console.log("\nAll consent-gate assertions passed.");
  } finally {
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
