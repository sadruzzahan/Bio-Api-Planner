import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, avg } from "drizzle-orm";
import { db, sleepSessionsTable } from "@workspace/db";
import {
  ListSleepQueryParams,
  ListSleepResponse,
  GetSleepTrendResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/sleep", async (req, res): Promise<void> => {
  const q = ListSleepQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { from, to } = q.data;
  const conditions = [eq(sleepSessionsTable.userId, DEMO_USER_ID)];
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
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(sleepSessionsTable)
    .where(and(eq(sleepSessionsTable.userId, DEMO_USER_ID), gte(sleepSessionsTable.onsetAt, d30)))
    .orderBy(sleepSessionsTable.date);

  if (rows.length === 0) {
    res.json(GetSleepTrendResponse.parse({
      avgTotalMinutes: 0, avgEfficiencyPct: 0, avgDeepMinutes: 0,
      avgRemMinutes: 0, sleepDebtMinutes: 0, points: [],
    }));
    return;
  }

  const totalSum = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const effSum = rows.reduce((s, r) => s + r.efficiencyPct, 0);
  const deepSum = rows.reduce((s, r) => s + r.deepMinutes, 0);
  const remSum = rows.reduce((s, r) => s + r.remMinutes, 0);
  const n = rows.length;
  const TARGET_SLEEP_MIN = 480;
  const avgTotal = totalSum / n;
  const sleepDebt = Math.max(0, (TARGET_SLEEP_MIN - avgTotal) * n);

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
    avgEfficiencyPct: effSum / n,
    avgDeepMinutes: deepSum / n,
    avgRemMinutes: remSum / n,
    sleepDebtMinutes: sleepDebt,
    points,
  }));
});

export default router;
