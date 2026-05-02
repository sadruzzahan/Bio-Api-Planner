import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, sleepSessionsTable } from "@workspace/db";
import {
  ListSleepQueryParams,
  ListSleepResponse,
  GetSleepTrendResponse,
} from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";
import { coerceDateFields } from "../lib/query-dates";

const router: IRouter = Router();

router.get("/sleep", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const q = ListSleepQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { from, to } = q.data;
  const conditions = [eq(sleepSessionsTable.userId, userId)];
  if (from) conditions.push(gte(sleepSessionsTable.onsetAt, from));
  if (to) conditions.push(lte(sleepSessionsTable.wakeAt, to));
  const rows = await db
    .select()
    .from(sleepSessionsTable)
    .where(and(...conditions))
    .orderBy(desc(sleepSessionsTable.date));
  res.json(ListSleepResponse.parse(rows));
});

router.get("/sleep/trend", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(sleepSessionsTable)
    .where(and(eq(sleepSessionsTable.userId, userId), gte(sleepSessionsTable.onsetAt, d30)))
    .orderBy(sleepSessionsTable.date);

  if (rows.length === 0) {
    res.json(GetSleepTrendResponse.parse({
      avgTotalMinutes: 0, avgEfficiencyPct: 0, avgDeepMinutes: 0,
      avgRemMinutes: 0, sleepDebtMinutes: 0, points: [],
    }));
    return;
  }

  const n = rows.length;
  const avgTotal = rows.reduce((s, r) => s + r.totalMinutes, 0) / n;
  const TARGET_SLEEP_MIN = 480;

  const points = rows.map((r) => ({
    date: new Date(r.date),
    totalMinutes: r.totalMinutes,
    deepMinutes: r.deepMinutes,
    remMinutes: r.remMinutes,
    lightMinutes: r.lightMinutes,
    efficiencyPct: r.efficiencyPct,
  }));

  res.json(GetSleepTrendResponse.parse({
    avgTotalMinutes: avgTotal,
    avgEfficiencyPct: rows.reduce((s, r) => s + r.efficiencyPct, 0) / n,
    avgDeepMinutes: rows.reduce((s, r) => s + r.deepMinutes, 0) / n,
    avgRemMinutes: rows.reduce((s, r) => s + r.remMinutes, 0) / n,
    sleepDebtMinutes: Math.max(0, (TARGET_SLEEP_MIN - avgTotal) * n),
    points,
  }));
});

export default router;
