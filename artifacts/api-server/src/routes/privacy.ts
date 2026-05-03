import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  usersTable,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
  biologicalStatesTable,
  interventionsTable,
  mealsTable,
  supplementsTable,
  chatMessagesTable,
  integrationsTable,
  consentRecordsTable,
  auditLogTable,
} from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { logger } from "../lib/logger";
import { decryptSecretsInObject, SECRET_INTEGRATION_FIELDS } from "../lib/encryption";
import { desc, isNotNull, lte } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /audit/log — return the user's most recent audit entries.
 * Capped at 200; the UI renders the last 100 by default.
 */
router.get("/audit/log", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rawLimit = Number((req.query as { limit?: unknown }).limit ?? 100);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.userId, userId))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit);
  res.json({ entries: rows });
});

/**
 * GET /users/me/export
 * Streams a JSON archive of every row owned by the user. Synchronous for v1
 * (Email task will switch this to a background job + emailed link). The
 * response is a single JSON object keyed by table; large fields are inlined.
 */
router.get("/users/me/export", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const startedAt = Date.now();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="bioos-export-${userId}-${new Date().toISOString().slice(0, 10)}.json"`,
  );

  try {
    const [
      user,
      biometrics,
      sleep,
      glucose,
      activity,
      states,
      interventions,
      meals,
      supplements,
      chats,
      integrations,
      consent,
      audit,
    ] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)),
      db.select().from(biometricReadingsTable).where(eq(biometricReadingsTable.userId, userId)),
      db.select().from(sleepSessionsTable).where(eq(sleepSessionsTable.userId, userId)),
      db.select().from(glucoseReadingsTable).where(eq(glucoseReadingsTable.userId, userId)),
      db.select().from(activitySessionsTable).where(eq(activitySessionsTable.userId, userId)),
      db.select().from(biologicalStatesTable).where(eq(biologicalStatesTable.userId, userId)),
      db.select().from(interventionsTable).where(eq(interventionsTable.userId, userId)),
      db.select().from(mealsTable).where(eq(mealsTable.userId, userId)),
      db.select().from(supplementsTable).where(eq(supplementsTable.userId, userId)),
      db.select().from(chatMessagesTable).where(eq(chatMessagesTable.userId, userId)),
      db.select().from(integrationsTable).where(eq(integrationsTable.userId, userId)),
      db.select().from(consentRecordsTable).where(eq(consentRecordsTable.userId, userId)),
      db.select().from(auditLogTable).where(eq(auditLogTable.userId, userId)),
    ]);

    // Decrypt integration secrets in the export — the user owns this data and
    // explicitly requested it. Drop the at-rest ciphertext column to avoid
    // confusion in the downloaded file.
    const integrationsExport = integrations.map((row) => ({
      ...row,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? decryptSecretsInObject(
              row.metadata as Record<string, unknown>,
              SECRET_INTEGRATION_FIELDS,
            )
          : row.metadata,
    }));

    // Strip the at-rest email ciphertext from the user copy; the plaintext
    // `email` column is already in the row.
    const userExport = user.map((u) => {
      const { emailEncrypted: _e, emailLookup: _l, ...rest } = u;
      return rest;
    });

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      generatedInMs: Date.now() - startedAt,
      user: userExport,
      tables: {
        biometric_readings: biometrics,
        sleep_sessions: sleep,
        glucose_readings: glucose,
        activity_sessions: activity,
        biological_states: states,
        interventions,
        meals,
        supplements,
        chat_messages: chats,
        integrations: integrationsExport,
        consent_records: consent,
        audit_log: audit,
      },
      counts: {
        biometric_readings: biometrics.length,
        sleep_sessions: sleep.length,
        glucose_readings: glucose.length,
        activity_sessions: activity.length,
        biological_states: states.length,
        interventions: interventions.length,
        meals: meals.length,
        supplements: supplements.length,
        chat_messages: chats.length,
        integrations: integrations.length,
        consent_records: consent.length,
        audit_log: audit.length,
      },
    };

    await recordAudit({
      userId,
      action: "export",
      entity: "user.data",
      metadata: { counts: payload.counts },
      req,
    });

    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    logger.error({ err }, "data export failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Export failed" });
    }
  }
});

/**
 * DELETE /users/me — soft-delete the account.
 * Sets `deleted_at`, schedules a hard purge in 30 days, signs the user out of
 * Clerk so all sessions are revoked. The actual purge is performed by
 * `purgeDeletedUsers()` (called from a daily job and the seed script).
 */
router.delete("/users/me", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const body = req.body as { confirmEmail?: unknown };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (
    typeof body.confirmEmail !== "string" ||
    body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
  ) {
    res.status(400).json({
      error:
        "Account deletion requires you to type your account email exactly to confirm.",
    });
    return;
  }

  const now = new Date();
  await db
    .update(usersTable)
    .set({ deletedAt: now, deletionRequestedAt: now })
    .where(eq(usersTable.id, userId));

  await recordAudit({
    userId,
    action: "account.delete.request",
    entity: "user",
    entityId: userId,
    metadata: { purgeAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    req,
  });

  // Best-effort: revoke all Clerk sessions for this user. We don't fully
  // remove the Clerk user until the hard purge runs so a user can change
  // their mind during the 30-day window.
  if (req.clerkUserId) {
    try {
      const sessions = await clerkClient.sessions.getSessionList({
        userId: req.clerkUserId,
      });
      for (const session of sessions.data ?? []) {
        await clerkClient.sessions.revokeSession(session.id);
      }
    } catch (err) {
      logger.warn({ err }, "failed to revoke Clerk sessions on delete");
    }
  }

  res.status(202).json({
    deletedAt: now.toISOString(),
    purgeAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

/** Hard-delete every row owned by users whose deleted_at is older than `cutoff`. */
export async function purgeDeletedUsers(cutoff: Date): Promise<number> {
  // Single indexed scan: only fetch rows that are actually past the cutoff.
  // ON DELETE CASCADE drops every owned row when we delete the user; audit
  // entries for these users are preserved because audit_log.user_id has
  // ON DELETE SET NULL, but we record an explicit purge event first so
  // there is always a trace of the action.
  const stale = await db
    .select({ id: usersTable.id, clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(and(isNotNull(usersTable.deletedAt), lte(usersTable.deletedAt, cutoff)));

  for (const u of stale) {
    // Audit BEFORE the delete so the row is committed even if cascade or
    // Clerk cleanup throws.
    await recordAudit({
      userId: u.id,
      action: "account.delete.purge",
      entity: "user",
      entityId: u.id,
    });
  }

  if (stale.length === 0) return 0;

  // One bulk delete. Postgres handles cascade in a single transaction.
  await db
    .delete(usersTable)
    .where(and(isNotNull(usersTable.deletedAt), lte(usersTable.deletedAt, cutoff)));

  // Best-effort Clerk cleanup. We continue on individual failures so one
  // unreachable Clerk user can't block the entire purge.
  for (const u of stale) {
    try {
      await clerkClient.users.deleteUser(u.clerkId);
    } catch (err) {
      logger.warn(
        { err, clerkId: u.clerkId },
        "failed to delete Clerk user during purge",
      );
    }
  }

  return stale.length;
}

export default router;
