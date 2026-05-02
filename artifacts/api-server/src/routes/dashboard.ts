import { Router, type IRouter } from "express";
import { and, eq, gte, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  biologicalStatesTable,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
  interventionsTable,
} from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";
import { classifyBiologicalState } from "../lib/state-classifier";
import { planInterventions } from "../lib/intervention-planner";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const DEMO_USER_ID = 1;

router.get("/dashboard", async (req, res): Promise<void> => {
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const state = await classifyBiologicalState(DEMO_USER_ID);
  await planInterventions(DEMO_USER_ID, state);

  const [biometrics, lastSleep, glucoseRows, activityRows, pendingRows] = await Promise.all([
    db.select().from(biometricReadingsTable)
      .where(and(eq(biometricReadingsTable.userId, DEMO_USER_ID), gte(biometricReadingsTable.recordedAt, h24))),
    db.select().from(sleepSessionsTable)
      .where(eq(sleepSessionsTable.userId, DEMO_USER_ID))
      .orderBy(desc(sleepSessionsTable.date)).limit(1),
    db.select().from(glucoseReadingsTable)
      .where(and(eq(glucoseReadingsTable.userId, DEMO_USER_ID), gte(glucoseReadingsTable.recordedAt, h24))),
    db.select().from(activitySessionsTable)
      .where(and(eq(activitySessionsTable.userId, DEMO_USER_ID), gte(activitySessionsTable.recordedAt, h24))),
    db.select().from(interventionsTable)
      .where(and(eq(interventionsTable.userId, DEMO_USER_ID), eq(interventionsTable.status, "pending")))
      .orderBy(desc(interventionsTable.triggeredAt)).limit(3),
  ]);

  const steps = biometrics.filter((b) => b.metric === "steps").reduce((s, b) => s + b.value, 0);
  const hrReadings = biometrics.filter((b) => b.metric === "heart_rate");
  const avgHeartRate = hrReadings.length > 0
    ? Math.round(hrReadings.reduce((s, b) => s + b.value, 0) / hrReadings.length)
    : 65;
  const sleepMinutes = lastSleep[0]?.totalMinutes ?? 0;
  const sleepEfficiencyPct = lastSleep[0]?.efficiencyPct ?? 0;
  const glucoseVals = glucoseRows.map((r) => r.valueMgdl);
  const glucoseAvgMgdl = glucoseVals.length > 0
    ? glucoseVals.reduce((s, v) => s + v, 0) / glucoseVals.length
    : 95;
  const glucoseRangeMgdl = glucoseVals.length > 0
    ? Math.max(...glucoseVals) - Math.min(...glucoseVals)
    : 0;
  const activeMinutes = activityRows.reduce((s, a) => s + a.durationMinutes, 0);
  const strainScore = activityRows.length > 0
    ? activityRows.reduce((s, a) => s + a.strainScore, 0) / activityRows.length
    : 0;

  const recentInsights = [
    {
      id: randomUUID(),
      title: `Readiness Score: ${state.readinessScore}/100`,
      body: `Your current biological state is ${state.recoveryState} recovery with ${state.energyState} energy levels. ${state.notes ?? ""}`,
      category: "recovery",
      severity: state.readinessScore >= 70 ? "info" : state.readinessScore >= 50 ? "warning" : "critical",
      createdAt: new Date(),
    },
  ];

  res.json(
    GetDashboardResponse.parse({
      user,
      state,
      summary: {
        steps: Math.round(steps),
        avgHeartRate,
        sleepMinutes,
        sleepEfficiencyPct,
        glucoseAvgMgdl,
        glucoseRangeMgdl,
        activeMinutes,
        strainScore,
      },
      pendingInterventions: pendingRows,
      recentInsights,
    }),
  );
});

export default router;
