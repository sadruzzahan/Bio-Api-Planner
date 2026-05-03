import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, mealsTable } from "@workspace/db";
import {
  ListMealsQueryParams,
  ListMealsResponse,
  CreateMealBody,
} from "@workspace/api-zod";
import { coerceDateFields } from "../lib/query-dates";
import { parsePagination } from "../lib/pagination";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/meals", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const q = ListMealsQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const conditions = [eq(mealsTable.userId, userId)];
  if (q.data.from) conditions.push(gte(mealsTable.loggedAt, q.data.from));
  if (q.data.to) conditions.push(lte(mealsTable.loggedAt, q.data.to));
  const rows = await db
    .select()
    .from(mealsTable)
    .where(and(...conditions))
    .orderBy(desc(mealsTable.loggedAt))
    .limit(limit)
    .offset(offset);
  res.json(ListMealsResponse.parse(rows));
});

router.post("/meals", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(mealsTable)
    .values({ ...parsed.data, userId })
    .returning();
  await recordAudit({
    userId,
    action: "create",
    entity: "meal",
    entityId: row?.id,
    req,
  });
  res.status(201).json(row);
});

export default router;
