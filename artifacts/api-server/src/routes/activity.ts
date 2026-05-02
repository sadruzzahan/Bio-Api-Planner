import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, activitySessionsTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";
import { coerceDateFields } from "../lib/query-dates";
import { parsePagination } from "../lib/pagination";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const q = ListActivityQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const { from, to } = q.data;
  const conditions = [eq(activitySessionsTable.userId, userId)];
  if (from) conditions.push(gte(activitySessionsTable.recordedAt, from));
  if (to) conditions.push(lte(activitySessionsTable.recordedAt, to));
  const rows = await db
    .select()
    .from(activitySessionsTable)
    .where(and(...conditions))
    .orderBy(desc(activitySessionsTable.recordedAt))
    .limit(limit)
    .offset(offset);
  res.json(ListActivityResponse.parse(rows));
});

export default router;
