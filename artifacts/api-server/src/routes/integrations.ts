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

const router: IRouter = Router();

router.get("/integrations", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));
  res.json(ListIntegrationsResponse.parse(rows));
});

router.post("/integrations/:provider/connect", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = ConnectIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)));

  if (existing.length > 0) {
    const [row] = await db
      .update(integrationsTable)
      .set({ status: "connected", connectedAt: new Date() })
      .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)))
      .returning();
    res.json(ConnectIntegrationResponse.parse(row));
    return;
  }

  const [row] = await db
    .insert(integrationsTable)
    .values({
      userId,
      provider: params.data.provider,
      category: "wearable",
      status: "connected",
      connectedAt: new Date(),
      metadata: {},
    })
    .returning();
  res.json(ConnectIntegrationResponse.parse(row));
});

router.delete("/integrations/:provider", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = DisconnectIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(integrationsTable)
    .set({ status: "disconnected", connectedAt: null })
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, params.data.provider)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  res.json(DisconnectIntegrationResponse.parse(row));
});

export default router;
