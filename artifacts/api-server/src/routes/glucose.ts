import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, glucoseReadingsTable } from "@workspace/db";
import {
  ListGlucoseQueryParams,
  ListGlucoseResponse,
  GetGlucoseTrendResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/glucose", async (req, res): Promise<void> => {
  const q = ListGlucoseQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { from, to, mealContext } = q.data;
  const conditions = [eq(glucoseReadingsTable.userId, DEMO_USER_ID)];
  if (from) conditions.push(gte(glucoseReadingsTable.recordedAt, from));
  if (to) conditions.push(lte(glucoseReadingsTable.recordedAt, to));
  if (mealContext) conditions.push(eq(glucoseReadingsTable.mealContext, mealContext));
  const rows = await db
    .select()
    .from(glucoseReadingsTable)
    .where(and(...conditions))
    .orderBy(desc(glucoseReadingsTable.recordedAt));
  res.json(ListGlucoseResponse.parse(rows));
});

router.get("/glucose/trend", async (req, res): Promise<void> => {
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(glucoseReadingsTable)
    .where(and(eq(glucoseReadingsTable.userId, DEMO_USER_ID), gte(glucoseReadingsTable.recordedAt, d30)))
    .orderBy(glucoseReadingsTable.recordedAt);

  if (rows.length === 0) {
    res.json(GetGlucoseTrendResponse.parse({
      avgMgdl: 0, variabilityPct: 0, timeInRangePct: 0,
      peakMgdl: 0, troughMgdl: 0, points: [],
    }));
    return;
  }

  const values = rows.map((r) => r.valueMgdl);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const peak = Math.max(...values);
  const trough = Math.min(...values);
  const inRange = values.filter((v) => v >= 70 && v <= 140).length;
  const timeInRangePct = (inRange / values.length) * 100;
  const stddev = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
  const variabilityPct = avg > 0 ? (stddev / avg) * 100 : 0;

  // Group by day
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const day = r.recordedAt.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r.valueMgdl);
  }
  const points = Array.from(byDay.entries()).map(([date, vals]) => {
    const dayAvg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const dayMin = Math.min(...vals);
    const dayMax = Math.max(...vals);
    const dayStd = Math.sqrt(vals.reduce((s, v) => s + (v - dayAvg) ** 2, 0) / vals.length);
    return {
      date: new Date(date),
      avgMgdl: dayAvg,
      minMgdl: dayMin,
      maxMgdl: dayMax,
      variabilityPct: dayAvg > 0 ? (dayStd / dayAvg) * 100 : 0,
    };
  });

  res.json(GetGlucoseTrendResponse.parse({ avgMgdl: avg, variabilityPct, timeInRangePct, peakMgdl: peak, troughMgdl: trough, points }));
});

export default router;
