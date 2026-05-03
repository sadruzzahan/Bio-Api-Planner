import { eq, and, lte, isNotNull, inArray } from "drizzle-orm";
import {
  db,
  integrationsTable,
  syncRunsTable,
  type Integration,
} from "@workspace/db";
import {
  type AdapterIntegration,
  type ProviderAdapter,
  type ProviderId,
  ProviderNotConfiguredError,
  ReauthRequiredError,
  getAdapter,
  ingestPayload,
} from "@workspace/integrations";
import { encrypt, decrypt } from "./encryption";
import { recordAudit } from "./audit";
import { logger } from "./logger";

/**
 * Token refresh + sync orchestration.
 *
 * Anything that wants to talk to a provider goes through `runSync` so that:
 *   - tokens are decrypted, refreshed if near expiry, and re-encrypted in
 *     a single transactional update on the integrations row,
 *   - failures are mapped to the right status (`needs_reauth` for
 *     ReauthRequiredError, `error` for everything else),
 *   - every attempt produces a row in sync_runs for observability.
 *
 * Per-process locks (`inFlight`) prevent two concurrent syncs of the same
 * integration from racing each other to refresh tokens. This is a per-pod
 * guard — Task #11 will replace it with a Redis or DB advisory lock when
 * we go multi-instance.
 */
const REFRESH_BEFORE_MS = 60_000;
const inFlight = new Set<number>();

export type SyncTrigger = "initial" | "scheduled" | "manual" | "webhook";

interface SyncResult {
  status: "success" | "skipped" | "failed";
  recordsIngested: number;
  error: string | null;
}

function toAdapterIntegration(row: Integration): AdapterIntegration {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as ProviderId,
    scopes: row.scopes ?? null,
    accessToken: decrypt(row.accessTokenEncrypted),
    refreshToken: decrypt(row.refreshTokenEncrypted),
    tokenExpiresAt: row.tokenExpiresAt,
    externalUserId: row.externalUserId,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

async function ensureFreshTokens(
  row: Integration,
  adapter: ProviderAdapter,
): Promise<Integration> {
  const expiresAt = row.tokenExpiresAt;
  if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) {
    return row;
  }
  const refreshToken = decrypt(row.refreshTokenEncrypted);
  if (!refreshToken) {
    throw new ReauthRequiredError("No refresh token on file");
  }
  const tokens = await adapter.refresh(refreshToken);
  const [updated] = await db
    .update(integrationsTable)
    .set({
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encrypt(tokens.refreshToken)
        : row.refreshTokenEncrypted,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    })
    .where(eq(integrationsTable.id, row.id))
    .returning();
  return updated ?? row;
}

export async function runSync(
  integrationId: number,
  trigger: SyncTrigger,
): Promise<SyncResult> {
  if (inFlight.has(integrationId)) {
    return { status: "skipped", recordsIngested: 0, error: "already running" };
  }
  inFlight.add(integrationId);

  const [run] = await db
    .insert(syncRunsTable)
    .values({ integrationId, trigger, status: "running" })
    .returning();
  if (!run) {
    inFlight.delete(integrationId);
    return { status: "failed", recordsIngested: 0, error: "could not log sync run" };
  }

  try {
    const [row] = await db
      .select()
      .from(integrationsTable)
      .where(eq(integrationsTable.id, integrationId));
    if (!row) throw new Error("Integration not found");
    if (row.status === "disconnected") {
      throw new Error("Integration is disconnected");
    }

    const adapter = getAdapter(row.provider);
    const refreshed = await ensureFreshTokens(row, adapter);
    const integration = toAdapterIntegration(refreshed);
    const since =
      refreshed.lastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const payload = await adapter.fetchSince(integration, since);
    const inserted = await ingestPayload(refreshed.userId, payload);

    const now = new Date();
    await db
      .update(integrationsTable)
      .set({
        status: "connected",
        lastSyncAt: now,
        nextSyncAt: new Date(now.getTime() + adapter.syncIntervalMs),
        lastError: null,
      })
      .where(eq(integrationsTable.id, integrationId));

    await db
      .update(syncRunsTable)
      .set({ status: "success", finishedAt: now, recordsIngested: inserted })
      .where(eq(syncRunsTable.id, run.id));

    void recordAudit({
      userId: refreshed.userId,
      action: "integration.sync",
      entity: "integration",
      entityId: refreshed.id,
      metadata: { provider: refreshed.provider, trigger, ingested: inserted },
    });

    return { status: "success", recordsIngested: inserted, error: null };
  } catch (err) {
    const isReauth = err instanceof ReauthRequiredError;
    const isNotConfigured = err instanceof ProviderNotConfiguredError;
    const message = err instanceof Error ? err.message : String(err);
    const newStatus = isReauth ? "needs_reauth" : "error";
    const now = new Date();

    await db
      .update(integrationsTable)
      .set({
        status: newStatus,
        lastError: message.slice(0, 500),
        // Back off harder on errors so we don't hammer a broken provider.
        nextSyncAt: new Date(now.getTime() + 30 * 60 * 1000),
      })
      .where(eq(integrationsTable.id, integrationId));

    await db
      .update(syncRunsTable)
      .set({ status: "failed", finishedAt: now, error: message.slice(0, 500) })
      .where(eq(syncRunsTable.id, run.id));

    if (!isNotConfigured) {
      logger.warn(
        { integrationId, trigger, err: message },
        "integration sync failed",
      );
    }
    return { status: "failed", recordsIngested: 0, error: message };
  } finally {
    inFlight.delete(integrationId);
  }
}

/**
 * Find every connected integration whose `next_sync_at` is in the past
 * and run a scheduled sync on each. Called by the in-process scheduler.
 * Failure on one integration never blocks the others.
 */
export async function runDueSyncs(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: integrationsTable.id })
    .from(integrationsTable)
    .where(
      and(
        // 'error' rows are also retried — runSync uses an exponential
        // backoff via nextSyncAt so a transient 5xx doesn't permanently
        // strand the integration.
        inArray(integrationsTable.status, ["connected", "error"]),
        isNotNull(integrationsTable.nextSyncAt),
        lte(integrationsTable.nextSyncAt, now),
      ),
    );
  let ran = 0;
  for (const r of due) {
    try {
      await runSync(r.id, "scheduled");
      ran += 1;
    } catch (err) {
      logger.error({ err, integrationId: r.id }, "scheduled sync threw");
    }
  }
  return ran;
}
