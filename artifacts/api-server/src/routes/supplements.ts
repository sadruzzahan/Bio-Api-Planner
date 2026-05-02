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

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/supplements", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(supplementsTable)
    .where(eq(supplementsTable.userId, DEMO_USER_ID));
  res.json(ListSupplementsResponse.parse(rows));
});

router.post("/supplements", async (req, res): Promise<void> => {
  const parsed = CreateSupplementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(supplementsTable)
    .values({ ...parsed.data, userId: DEMO_USER_ID })
    .returning();
  res.status(201).json(row);
});

router.patch("/supplements/:id", async (req, res): Promise<void> => {
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
    .where(and(eq(supplementsTable.id, params.data.id), eq(supplementsTable.userId, DEMO_USER_ID)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplement not found" });
    return;
  }
  res.json(UpdateSupplementResponse.parse(row));
});

router.delete("/supplements/:id", async (req, res): Promise<void> => {
  const params = DeleteSupplementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(supplementsTable)
    .where(and(eq(supplementsTable.id, params.data.id), eq(supplementsTable.userId, DEMO_USER_ID)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplement not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
