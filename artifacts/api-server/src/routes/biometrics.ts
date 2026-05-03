import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, avg, min, max } from "drizzle-orm";
import { db, biometricReadingsTable } from "@workspace/db";
import {
  ListBiometricsQueryParams,
  ListBiometricsResponse,
  CreateBiometricBody,
  GetBiometricsSummaryResponse,
} from "@workspace/api-zod";
import { coerceDateFields } from "../lib/query-dates";

const router: IRouter = Router();

router.get("/biometrics", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const q = ListBiometricsQueryParams.safeParse(
    coerceDateFields(req.query as Record<string, unknown>, ["from", "to"]),
  );
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const { metric, source, from, to, limit } = q.data;
  const conditions = [eq(biometricReadingsTable.userId, userId)];
  if (metric) conditions.push(eq(biometricReadingsTable.metric, metric));
  if (source) conditions.push(eq(biometricReadingsTable.source, source));
  if (from) conditions.push(gte(biometricReadingsTable.recordedAt, from));
  if (to) conditions.push(lte(biometricReadingsTable.recordedAt, to));

  const rows = await db
    .select()
    .from(biometricReadingsTable)
    .where(and(...conditions))
    .orderBy(desc(biometricReadingsTable.recordedAt))
    .limit(limit);
  res.json(ListBiometricsResponse.parse(rows));
});

router.post("/biometrics", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = CreateBiometricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(biometricReadingsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(row);
});

router.get("/biometrics/summary", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const metrics = await db
    .selectDistinct({ metric: biometricReadingsTable.metric, unit: biometricReadingsTable.unit })
    .from(biometricReadingsTable)
    .where(eq(biometricReadingsTable.userId, userId));

  const results = await Promise.all(
    metrics.map(async ({ metric, unit }) => {
      const base = and(
        eq(biometricReadingsTable.userId, userId),
        eq(biometricReadingsTable.metric, metric),
      );
      const [agg7] = await db
        .select({ avg: avg(biometricReadingsTable.value), min: min(biometricReadingsTable.value), max: max(biometricReadingsTable.value) })
        .from(biometricReadingsTable)
        .where(and(base, gte(biometricReadingsTable.recordedAt, d7)));
      const [agg30] = await db
        .select({ avg: avg(biometricReadingsTable.value) })
        .from(biometricReadingsTable)
        .where(and(base, gte(biometricReadingsTable.recordedAt, d30)));
      const [agg24] = await db
        .select({ avg: avg(biometricReadingsTable.value) })
        .from(biometricReadingsTable)
        .where(and(base, gte(biometricReadingsTable.recordedAt, h24)));
      const [latest] = await db
        .select({ value: biometricReadingsTable.value, recordedAt: biometricReadingsTable.recordedAt })
        .from(biometricReadingsTable)
        .where(base)
        .orderBy(desc(biometricReadingsTable.recordedAt))
        .limit(1);

      const avg7 = agg7?.avg != null ? parseFloat(String(agg7.avg)) : null;
      const avg30n = agg30?.avg != null ? parseFloat(String(agg30.avg)) : null;
      const trendPct = avg7 != null && avg30n != null && avg30n !== 0
        ? ((avg7 - avg30n) / avg30n) * 100
        : null;
      return {
        metric,
        unit,
        last24hAvg: agg24?.avg != null ? parseFloat(String(agg24.avg)) : null,
        sevenDayAvg: avg7,
        thirtyDayAvg: avg30n,
        sevenDayMin: agg7?.min != null ? parseFloat(String(agg7.min)) : null,
        sevenDayMax: agg7?.max != null ? parseFloat(String(agg7.max)) : null,
        trendPct,
        latest: latest?.value ?? null,
        latestAt: latest?.recordedAt ?? null,
      };
    }),
  );
  res.json(GetBiometricsSummaryResponse.parse(results));
});

export default router;
