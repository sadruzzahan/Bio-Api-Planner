import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, activitySessionsTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/activity", async (req, res): Promise<void> => {
  const q = ListActivityQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { from, to } = q.data;
  const conditions = [eq(activitySessionsTable.userId, DEMO_USER_ID)];
  if (from) conditions.push(gte(activitySessionsTable.recordedAt, from));
  if (to) conditions.push(lte(activitySessionsTable.recordedAt, to));
  const rows = await db
    .select()
    .from(activitySessionsTable)
    .where(and(...conditions))
    .orderBy(desc(activitySessionsTable.recordedAt));
  res.json(ListActivityResponse.parse(rows));
});

export default router;
