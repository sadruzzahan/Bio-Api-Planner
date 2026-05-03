import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, biologicalStatesTable } from "@workspace/db";
import {
  GetCurrentStateResponse,
  GetStateHistoryQueryParams,
  GetStateHistoryResponse,
} from "@workspace/api-zod";
import { classifyBiologicalState } from "../lib/state-classifier";
import { planInterventions } from "../lib/intervention-planner";
import { coerceDateFields } from "../lib/query-dates";
import { parsePagination } from "../lib/pagination";

const router: IRouter = Router();

router.get("/state/current", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const state = await classifyBiologicalState(userId);
  await planInterventions(userId, state);
  res.json(GetCurrentStateResponse.parse(state));
});

router.get("/state/history", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const q = GetStateHistoryQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const conditions = [eq(biologicalStatesTable.userId, userId)];
  if (q.data.from) conditions.push(gte(biologicalStatesTable.computedAt, q.data.from));
  if (q.data.to) conditions.push(lte(biologicalStatesTable.computedAt, q.data.to));
  const rows = await db
    .select()
    .from(biologicalStatesTable)
    .where(and(...conditions))
    .orderBy(desc(biologicalStatesTable.computedAt))
    .limit(limit)
    .offset(offset);
  res.json(GetStateHistoryResponse.parse(rows));
});

export default router;
