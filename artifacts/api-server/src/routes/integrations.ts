import express, { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, integrationsTable, syncRunsTable } from "@workspace/db";
import {
  ProviderNotConfiguredError,
  getAdapter,
  isProviderConfigured,
  listAdapters,
  signOauthState,
  verifyOauthState,
  type ProviderId,
} from "@workspace/integrations";
import { recordAudit } from "../lib/audit";
import { encrypt, decrypt } from "../lib/encryption";
import { runSync } from "../lib/integration-sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FRONTEND_BASE =
  process.env.PUBLIC_APP_URL ??
  process.env.OAUTH_REDIRECT_BASE ??
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
const FRONTEND_INTEGRATIONS_PATH = "/integrations";

/**
 * Project the persisted integration row + adapter metadata into the
 * `Integration` view shape declared by the API spec. Tokens are NEVER
 * exposed; only the projected fields below leave the server.
 */
function projectIntegration(opts: {
  provider: ProviderId;
  row?:
    | typeof integrationsTable.$inferSelect
    | undefined;
}) {
  const adapter = getAdapter(opts.provider);
  const row = opts.row;
  return {
    id: row?.id ?? null,
    userId: row?.userId ?? null,
    provider: adapter.id,
    category: adapter.category,
    displayName: adapter.displayName,
    description: adapter.description,
    status: row?.status ?? "disconnected",
    scopes: row?.scopes ?? null,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    disconnectedAt: row?.disconnectedAt?.toISOString() ?? null,
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    nextSyncAt: row?.nextSyncAt?.toISOString() ?? null,
    tokenExpiresAt: row?.tokenExpiresAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    configured: isProviderConfigured(adapter.id),
    sandbox: adapter.sandbox,
    supportsWebhooks: adapter.supportsWebhooks,
    metadata: {},
  };
}

// GET /integrations — return one entry per known adapter, merged with any
// existing user row. The UI uses this as both the connection state and
// the catalogue, so unconfigured providers show a "Not configured" badge
// rather than disappearing.
router.get("/integrations", async (req, res) => {
  const userId = req.userId!;
  const rows = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const out = listAdapters().map((a) =>
    projectIntegration({ provider: a.id, row: byProvider.get(a.id) }),
  );
  res.json(out);
});

// GET /integrations/:provider/authorize-url — build the provider's OAuth
// authorize URL and seed an integrations row in `connecting` state. The
// frontend opens the URL in a top-level navigation; the user is sent
// back to /api/integrations/:provider/callback after consent.
router.get("/integrations/:provider/authorize-url", async (req, res) => {
  const userId = req.userId!;
  const provider = req.params.provider as ProviderId;
  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    res.status(404).json({ error: "Unknown provider", provider });
    return;
  }
  try {
    const state = signOauthState(userId, provider);
    const url = adapter.oauthAuthorizeUrl(state);
    // Upsert a row in `connecting` state so the UI can reflect that
    // the OAuth handshake is in flight even before the callback fires.
    const [existing] = await db
      .select()
      .from(integrationsTable)
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
    if (existing) {
      await db
        .update(integrationsTable)
        .set({ status: "connecting", lastError: null })
        .where(eq(integrationsTable.id, existing.id));
    } else {
      await db.insert(integrationsTable).values({
        userId,
        provider,
        category: adapter.category,
        status: "connecting",
      });
    }
    res.json({ url });
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      res.status(503).json({
        error: err.message,
        provider,
        missing: err.message.match(/: (\S+) is missing/)?.[1] ?? "",
      });
      return;
    }
    logger.error({ err, provider }, "authorize-url failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /integrations/:provider/callback — provider redirects the user
// here with `code` + `state`. We exchange the code for tokens, encrypt
// and persist them, mark the row connected, and redirect the user back
// to the SPA. Errors are surfaced via querystring so the SPA can render
// a clear failure banner.
router.get("/integrations/:provider/callback", async (req, res) => {
  const userId = req.userId!;
  const provider = req.params.provider as ProviderId;
  const back = (q: string) =>
    res.redirect(`${FRONTEND_BASE}${FRONTEND_INTEGRATIONS_PATH}${q}`);

  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    back(`?error=unknown_provider&provider=${provider}`);
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const errParam = typeof req.query.error === "string" ? req.query.error : null;
  if (errParam) {
    await db
      .update(integrationsTable)
      .set({ status: "disconnected", lastError: errParam.slice(0, 500) })
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
    back(`?provider=${provider}&error=${encodeURIComponent(errParam)}`);
    return;
  }
  if (!code || !state) {
    back(`?provider=${provider}&error=missing_code`);
    return;
  }
  try {
    verifyOauthState(state, userId, provider);
  } catch (err) {
    logger.warn({ err, provider, userId }, "oauth state verification failed");
    back(`?provider=${provider}&error=invalid_state`);
    return;
  }

  try {
    const tokens = await adapter.exchangeCode(code);
    const now = new Date();
    const [existing] = await db
      .select()
      .from(integrationsTable)
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
    let id: number;
    if (existing) {
      await db
        .update(integrationsTable)
        .set({
          status: "connected",
          scopes: tokens.scopes,
          accessTokenEncrypted: encrypt(tokens.accessToken),
          refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          externalUserId: tokens.externalUserId,
          connectedAt: now,
          disconnectedAt: null,
          lastError: null,
          // Trigger an initial sync immediately on the next scheduler tick.
          nextSyncAt: now,
          metadata: { ...(existing.metadata as Record<string, unknown>), ...(tokens.metadata ?? {}) },
        })
        .where(eq(integrationsTable.id, existing.id));
      id = existing.id;
    } else {
      const [inserted] = await db
        .insert(integrationsTable)
        .values({
          userId,
          provider,
          category: adapter.category,
          status: "connected",
          scopes: tokens.scopes,
          accessTokenEncrypted: encrypt(tokens.accessToken),
          refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          externalUserId: tokens.externalUserId,
          connectedAt: now,
          nextSyncAt: now,
          metadata: tokens.metadata ?? {},
        })
        .returning({ id: integrationsTable.id });
      id = inserted!.id;
    }
    void recordAudit({
      userId,
      action: "create",
      entity: "integration",
      entityId: id,
      metadata: { provider, status: "connected", scopes: tokens.scopes },
      req,
    });
    // Fire-and-forget initial sync so the user sees data on return.
    void runSync(id, "initial").catch((err) =>
      logger.warn({ err, integrationId: id }, "initial sync failed"),
    );
    back(`?provider=${provider}&connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ provider, err: msg }, "oauth code exchange failed");
    await db
      .update(integrationsTable)
      .set({ status: "error", lastError: msg.slice(0, 500) })
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
    back(`?provider=${provider}&error=exchange_failed`);
  }
});

// DELETE /integrations/:provider — disconnect, revoke, wipe tokens.
router.delete("/integrations/:provider", async (req, res) => {
  const userId = req.userId!;
  const provider = req.params.provider as ProviderId;
  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  const accessToken = decrypt(row.accessTokenEncrypted);
  if (accessToken) {
    try {
      await adapter.revoke(accessToken);
    } catch (err) {
      logger.warn({ err, provider }, "provider revoke failed (tokens still wiped locally)");
    }
  }
  const [updated] = await db
    .update(integrationsTable)
    .set({
      status: "disconnected",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      scopes: null,
      nextSyncAt: null,
      disconnectedAt: new Date(),
      lastError: null,
      metadata: {},
    })
    .where(eq(integrationsTable.id, row.id))
    .returning();
  void recordAudit({
    userId,
    action: "delete",
    entity: "integration",
    entityId: row.id,
    metadata: { provider },
    req,
  });
  res.json(projectIntegration({ provider, row: updated }));
});

// POST /integrations/:id/sync — manual sync.
router.post("/integrations/:id/sync", async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  const result = await runSync(id, "manual");
  res.json(result);
});

// GET /integrations/:id/runs — recent sync history.
router.get("/integrations/:id/runs", async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  const runs = await db
    .select()
    .from(syncRunsTable)
    .where(eq(syncRunsTable.integrationId, id))
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(20);
  res.json(
    runs.map((r) => ({
      id: r.id,
      integrationId: r.integrationId,
      trigger: r.trigger,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      status: r.status,
      recordsIngested: r.recordsIngested,
      error: r.error,
    })),
  );
});

// --- Webhooks ---------------------------------------------------------------
//
// Webhook endpoints are public (no Clerk session) and ride a separate
// router exported below. The mount point in routes/index.ts puts them
// on /api/webhooks. We use express.raw() so the body is the exact bytes
// the provider signed — JSON body parsing happens AFTER we verify.
export const webhookRouter: IRouter = Router();

webhookRouter.post(
  "/webhooks/:provider",
  express.raw({ type: "*/*", limit: "1mb" }),
  async (req, res) => {
    const provider = req.params.provider as ProviderId;
    let adapter;
    try {
      adapter = getAdapter(provider);
    } catch {
      res.status(404).json({ error: "Unknown provider" });
      return;
    }
    if (!adapter.supportsWebhooks || !adapter.verifyWebhook) {
      res.status(404).json({ error: "Provider does not push webhooks" });
      return;
    }
    try {
      adapter.verifyWebhook(req.body as Buffer, req.headers);
    } catch (err) {
      logger.warn({ provider, err }, "webhook signature rejected");
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    // Best-effort: parse the body as JSON, find any user_id field the
    // provider gave us, and trigger a sync for the matching integration.
    // We never trust webhook payloads as a source of truth — they only
    // tell us "go fetch now".
    try {
      const json = JSON.parse(req.body.toString("utf8")) as Record<string, unknown>;
      const externalUserId =
        json["user_id"] != null ? String(json["user_id"]) :
        json["userId"]  != null ? String(json["userId"])  : null;
      if (externalUserId) {
        const [row] = await db
          .select()
          .from(integrationsTable)
          .where(and(
            eq(integrationsTable.provider, provider),
            eq(integrationsTable.externalUserId, externalUserId),
          ));
        if (row) {
          void runSync(row.id, "webhook").catch((err) =>
            logger.warn({ err, integrationId: row.id }, "webhook-triggered sync failed"),
          );
        }
      }
    } catch (err) {
      logger.warn({ err, provider }, "webhook body parse failed");
    }
    res.status(204).end();
  },
);

export default router;
