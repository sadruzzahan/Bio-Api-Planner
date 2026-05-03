import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, supplementsTable } from "@workspace/db";
import {
  ListSupplementsResponse,
  CreateSupplementBody,
  UpdateSupplementParams,
  UpdateSupplementBody,
  UpdateSupplementResponse,
  DeleteSupplementParams,
} from "@workspace/api-zod";
import { parsePagination } from "../lib/pagination";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/supplements", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(supplementsTable)
    .where(eq(supplementsTable.userId, userId))
    .limit(limit)
    .offset(offset);
  res.json(ListSupplementsResponse.parse(rows));
});

router.post("/supplements", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = CreateSupplementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(supplementsTable)
    .values({ ...parsed.data, userId })
    .returning();
  await recordAudit({
    userId,
    action: "create",
    entity: "supplement",
    entityId: row?.id,
    metadata: { name: parsed.data.name },
    req,
  });
  res.status(201).json(row);
});

router.patch("/supplements/:id", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = UpdateSupplementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateSupplementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .update(supplementsTable)
    .set(body.data)
    .where(and(eq(supplementsTable.id, params.data.id), eq(supplementsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplement not found" });
    return;
  }
  await recordAudit({
    userId,
    action: "update",
    entity: "supplement",
    entityId: row.id,
    metadata: { fields: Object.keys(body.data) },
    req,
  });
  res.json(UpdateSupplementResponse.parse(row));
});

router.delete("/supplements/:id", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const params = DeleteSupplementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(supplementsTable)
    .where(and(eq(supplementsTable.id, params.data.id), eq(supplementsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplement not found" });
    return;
  }
  await recordAudit({
    userId,
    action: "delete",
    entity: "supplement",
    entityId: row.id,
    req,
  });
  res.sendStatus(204);
});

export default router;
