import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, mealsTable } from "@workspace/db";
import {
  ListMealsQueryParams,
  ListMealsResponse,
  CreateMealBody,
} from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";
import { coerceDateFields } from "../lib/query-dates";

const router: IRouter = Router();

router.get("/meals", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const q = ListMealsQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const conditions = [eq(mealsTable.userId, userId)];
  if (q.data.from) conditions.push(gte(mealsTable.loggedAt, q.data.from));
  if (q.data.to) conditions.push(lte(mealsTable.loggedAt, q.data.to));
  const rows = await db
    .select()
    .from(mealsTable)
    .where(and(...conditions))
    .orderBy(desc(mealsTable.loggedAt));
  res.json(ListMealsResponse.parse(rows));
});

router.post("/meals", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(mealsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(row);
});

export default router;
