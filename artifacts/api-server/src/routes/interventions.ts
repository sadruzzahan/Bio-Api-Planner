import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, interventionsTable } from "@workspace/db";
import {
  ListInterventionsQueryParams,
  ListInterventionsResponse,
  UpdateInterventionParams,
  UpdateInterventionBody,
  UpdateInterventionResponse,
} from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";

const router: IRouter = Router();

router.get("/interventions", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const q = ListInterventionsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const conditions = [eq(interventionsTable.userId, userId)];
  if (q.data.status) conditions.push(eq(interventionsTable.status, q.data.status));
  const rows = await db
    .select()
    .from(interventionsTable)
    .where(and(...conditions))
    .orderBy(desc(interventionsTable.triggeredAt));
  res.json(ListInterventionsResponse.parse(rows));
});

router.patch("/interventions/:id", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const params = UpdateInterventionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateInterventionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { status: body.data.status };
  if (body.data.status === "executed") updateData.executedAt = new Date();
  const [row] = await db
    .update(interventionsTable)
    .set(updateData)
    .where(and(eq(interventionsTable.id, params.data.id), eq(interventionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Intervention not found" });
    return;
  }
  res.json(UpdateInterventionResponse.parse(row));
});

export default router;
