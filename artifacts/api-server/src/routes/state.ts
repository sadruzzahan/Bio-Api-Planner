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

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/state/current", async (req, res): Promise<void> => {
  const state = await classifyBiologicalState(DEMO_USER_ID);
  await planInterventions(DEMO_USER_ID, state);
  res.json(GetCurrentStateResponse.parse(state));
});

router.get("/state/history", async (req, res): Promise<void> => {
  const q = GetStateHistoryQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const conditions = [eq(biologicalStatesTable.userId, DEMO_USER_ID)];
  if (q.data.from) conditions.push(gte(biologicalStatesTable.computedAt, q.data.from));
  if (q.data.to) conditions.push(lte(biologicalStatesTable.computedAt, q.data.to));
  const rows = await db
    .select()
    .from(biologicalStatesTable)
    .where(and(...conditions))
    .orderBy(desc(biologicalStatesTable.computedAt))
    .limit(100);
  res.json(GetStateHistoryResponse.parse(rows));
});

export default router;
