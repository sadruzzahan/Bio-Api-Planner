/**
 * Deletion-integrity test (Task #7 follow-up).
 *
 * Creates a synthetic user, populates one row in EVERY user-owned table,
 * runs the same hard-purge query that DELETE /users/me uses, then asserts
 * that no row in any user-owned table still references the purged userId.
 *
 * Exits 0 on success, non-zero on the first orphaned reference.
 *
 * Run with:  pnpm --filter @workspace/api-server run test:deletion
 */
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import { encrypt, emailLookupHash } from "../lib/encryption";

// Every table that holds a user_id FK. Keep this list in sync with the
// schema — the audit_log table uses ON DELETE SET NULL, so we verify
// that branch separately.
const CASCADE_TABLES = [
  "biometric_readings",
  "sleep_sessions",
  "glucose_readings",
  "activity_sessions",
  "biological_states",
  "interventions",
  "meals",
  "supplements",
  "chat_messages",
  "integrations",
  "consent_records",
] as const;

const SET_NULL_TABLES = ["audit_log"] as const;

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`❌ ${msg}`);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function main() {
  const marker = `deletion-test-${crypto.randomUUID()}@bioos.test`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId: `del-test-${crypto.randomUUID()}`,
      emailEncrypted: encrypt(marker),
      emailLookup: emailLookupHash(marker),
      name: "Deletion Test",
    })
    .returning({ id: usersTable.id });
  if (!user) throw new Error("Failed to create test user");
  const uid = user.id;
  console.log(`Created synthetic user id=${uid}`);

  // Insert one row into every cascade table using minimal-required values.
  // Raw SQL keeps the script independent of column-level schema drift —
  // we only ever care about the user_id linkage here.
  await db.execute(sql`INSERT INTO biometric_readings (user_id, source, metric, value, unit, recorded_at) VALUES (${uid}, 'test', 'hrv', 50, 'ms', now())`);
  await db.execute(sql`INSERT INTO sleep_sessions (user_id, source, date, total_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, efficiency_pct, onset_at, wake_at) VALUES (${uid}, 'test', current_date, 480, 90, 90, 270, 30, 90, now() - interval '8 hours', now())`);
  await db.execute(sql`INSERT INTO glucose_readings (user_id, value_mgdl, recorded_at) VALUES (${uid}, 95, now())`);
  await db.execute(sql`INSERT INTO activity_sessions (user_id, source, type, duration_minutes, intensity, strain_score, recorded_at) VALUES (${uid}, 'test', 'walk', 30, 'low', 5.0, now())`);
  await db.execute(sql`INSERT INTO biological_states (user_id, energy_state, recovery_state, cognitive_state, stress_state, metabolic_state, readiness_score) VALUES (${uid}, 'optimal', 'recovered', 'sharp', 'calm', 'fed', 80)`);
  await db.execute(sql`INSERT INTO interventions (user_id, type, title, action, rationale, status) VALUES (${uid}, 'breath', 't', 'a', 'r', 'pending')`);
  await db.execute(sql`INSERT INTO meals (user_id, logged_at, description, calories, carbs_g, protein_g, fat_g) VALUES (${uid}, now(), 'snack', 200, 20, 10, 5)`);
  await db.execute(sql`INSERT INTO supplements (user_id, name, dose_mg, timing) VALUES (${uid}, 'mag', 300, 'evening')`);
  await db.execute(sql`INSERT INTO chat_messages (user_id, role, content) VALUES (${uid}, 'user', 'hi')`);
  await db.execute(sql`INSERT INTO integrations (user_id, provider, category, status) VALUES (${uid}, 'whoop', 'wearable', 'connected')`);
  await db.execute(sql`INSERT INTO consent_records (user_id, document, version, accepted) VALUES (${uid}, 'terms', 'v1.0', true)`);
  await db.execute(sql`INSERT INTO audit_log (user_id, actor_id, action, entity) VALUES (${uid}, ${uid}, 'create', 'test')`);

  // Sanity: every table now has at least one row for this user.
  for (const t of [...CASCADE_TABLES, ...SET_NULL_TABLES]) {
    const r = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = ${uid}`));
    const n = Number((r.rows as Array<{ n: number }>)[0]?.n ?? 0);
    assert(n >= 1, `seeded ${t} with ${n} row(s)`);
  }

  // Hard-delete the user — this is what DELETE /users/me ultimately runs
  // after the purge grace period elapses.
  await db.execute(sql`DELETE FROM users WHERE id = ${uid}`);

  // Cascade tables: every row must be gone.
  for (const t of CASCADE_TABLES) {
    const r = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = ${uid}`));
    const n = Number((r.rows as Array<{ n: number }>)[0]?.n ?? 0);
    assert(n === 0, `cascade: ${t} has ${n} orphan row(s) referencing deleted user`);
  }

  // SET NULL tables: row may persist but user_id must be NULL.
  for (const t of SET_NULL_TABLES) {
    const r = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = ${uid}`));
    const n = Number((r.rows as Array<{ n: number }>)[0]?.n ?? 0);
    assert(n === 0, `set-null: ${t} still has ${n} row(s) with non-null user_id after delete`);
  }

  // The user row itself must be gone.
  const u = await db.execute(sql`SELECT count(*)::int AS n FROM users WHERE id = ${uid}`);
  assert(Number((u.rows as Array<{ n: number }>)[0]?.n) === 0, "users row removed");

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed. Deletion is NOT clean.`);
    process.exit(1);
  }
  console.log("\nAll deletion-integrity assertions passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
