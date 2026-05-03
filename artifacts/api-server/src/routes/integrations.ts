import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, integrationsTable } from "@workspace/db";
import {
  ListIntegrationsResponse,
  ConnectIntegrationParams,
  ConnectIntegrationResponse,
  DisconnectIntegrationParams,
  DisconnectIntegrationResponse,
} from "@workspace/api-zod";
import { recordAudit } from "../lib/audit";
import {
  encryptSecretsInObject,
  decryptSecretsInObject,
  SECRET_INTEGRATION_FIELDS,
} from "../lib/encryption";

const router: IRouter = Router();

/** Strip token fields from a metadata object before sending it to the client. */
function redactMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if ((SECRET_INTEGRATION_FIELDS as readonly string[]).includes(k)) {
      out[k] = "***";
    } else {
      out[k] = v;
    }
  }
  return out;
}

router.get("/integrations", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));
  // Never echo decrypted tokens to the SPA — only the export endpoint does.
  const safe = rows.map((r) => ({ ...r, metadata: redactMetadata(r.metadata) }));
  res.json(ListIntegrationsResponse.parse(safe));
});

router.post("/integrations/:provider/connect", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = ConnectIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const incomingMeta =
    req.body && typeof req.body === "object" && req.body !== null
      ? ((req.body as { metadata?: unknown }).metadata ?? {})
      : {};
  const encryptedMeta = encryptSecretsInObject(
    typeof incomingMeta === "object" && incomingMeta !== null
      ? (incomingMeta as Record<string, unknown>)
      : {},
    SECRET_INTEGRATION_FIELDS,
  );

  const existing = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)));

  let row;
  if (existing.length > 0) {
    [row] = await db
      .update(integrationsTable)
      .set({ status: "connected", connectedAt: new Date(), metadata: encryptedMeta })
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)))
      .returning();
  } else {
    [row] = await db
      .insert(integrationsTable)
      .values({
        userId,
        provider: params.data.provider,
        category: "wearable",
        status: "connected",
        connectedAt: new Date(),
        metadata: encryptedMeta,
      })
      .returning();
  }

  await recordAudit({
    userId,
    action: existing.length > 0 ? "update" : "create",
    entity: "integration",
    entityId: row?.id,
    metadata: { provider: params.data.provider, status: "connected" },
    req,
  });

  res.json(
    ConnectIntegrationResponse.parse({
      ...row,
      metadata: redactMetadata(row?.metadata),
    }),
  );
});

router.delete("/integrations/:provider", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = DisconnectIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // On disconnect, also wipe the secrets from metadata so we don't keep stale
  // tokens around indefinitely.
  const [row] = await db
    .update(integrationsTable)
    .set({ status: "disconnected", connectedAt: null, metadata: {} })
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  await recordAudit({
    userId,
    action: "delete",
    entity: "integration",
    entityId: row.id,
    metadata: { provider: params.data.provider },
    req,
  });
  res.json(
    DisconnectIntegrationResponse.parse({
      ...row,
      metadata: redactMetadata(row.metadata),
    }),
  );
});

// Re-export the decrypt helper so the data export endpoint can reach into
// integration metadata (kept here so consumers don't have to know which
// fields are encrypted).
export { decryptSecretsInObject, SECRET_INTEGRATION_FIELDS };

export default router;
