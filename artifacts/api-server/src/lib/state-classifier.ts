import { and, eq, gte, desc, avg } from "drizzle-orm";
import {
  db,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
  biologicalStatesTable,
} from "@workspace/db";

type StateLevel = "optimal" | "good" | "moderate" | "low" | "critical";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export async function classifyBiologicalState(userId: number) {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const userEq = eq(biometricReadingsTable.userId, userId);

  const [hrv7Row] = await db
    .select({ avg: avg(biometricReadingsTable.value) })
    .from(biometricReadingsTable)
    .where(and(userEq, eq(biometricReadingsTable.metric, "hrv"), gte(biometricReadingsTable.recordedAt, d7)));
  const [hrv30Row] = await db
    .select({ avg: avg(biometricReadingsTable.value) })
    .from(biometricReadingsTable)
    .where(and(userEq, eq(biometricReadingsTable.metric, "hrv"), gte(biometricReadingsTable.recordedAt, d30)));
  const [latestHrv] = await db
    .select({ value: biometricReadingsTable.value })
    .from(biometricReadingsTable)
    .where(and(userEq, eq(biometricReadingsTable.metric, "hrv")))
    .orderBy(desc(biometricReadingsTable.recordedAt))
    .limit(1);
  const hrv7 = hrv7Row?.avg != null ? parseFloat(String(hrv7Row.avg)) : null;
  const hrv30 = hrv30Row?.avg != null ? parseFloat(String(hrv30Row.avg)) : null;
  const currentHrv = latestHrv?.value ?? hrv7 ?? 55;

  let recoveryState: StateLevel = "moderate";
  if (hrv30 && hrv30 > 0) {
    const ratio = currentHrv / hrv30;
    if (ratio >= 1.15) recoveryState = "optimal";
    else if (ratio >= 1.02) recoveryState = "good";
    else if (ratio >= 0.88) recoveryState = "moderate";
    else if (ratio >= 0.75) recoveryState = "low";
    else recoveryState = "critical";
  } else {
    recoveryState = currentHrv >= 65 ? "good" : currentHrv >= 50 ? "moderate" : "low";
  }

  const [lastSleep] = await db
    .select()
    .from(sleepSessionsTable)
    .where(and(eq(sleepSessionsTable.userId, userId), gte(sleepSessionsTable.onsetAt, d7)))
    .orderBy(desc(sleepSessionsTable.date))
    .limit(1);
  const sleepEff = lastSleep?.efficiencyPct ?? 75;
  const deepMin = lastSleep?.deepMinutes ?? 60;
  const totalMin = lastSleep?.totalMinutes ?? 420;

  let energyState: StateLevel = "moderate";
  const sleepScore = (sleepEff / 100) * 50 + clamp(deepMin / 90, 0, 1) * 30 + clamp(totalMin / 480, 0, 1) * 20;
  if (sleepScore >= 85) energyState = "optimal";
  else if (sleepScore >= 70) energyState = "good";
  else if (sleepScore >= 55) energyState = "moderate";
  else if (sleepScore >= 40) energyState = "low";
  else energyState = "critical";

  const glucoseRows = await db
    .select({ value: glucoseReadingsTable.valueMgdl })
    .from(glucoseReadingsTable)
    .where(and(eq(glucoseReadingsTable.userId, userId), gte(glucoseReadingsTable.recordedAt, h24)));
  const glucoseVals = glucoseRows.map((r) => r.value);
  const glucoseAvg = glucoseVals.length > 0 ? glucoseVals.reduce((s, v) => s + v, 0) / glucoseVals.length : 95;
  const glucoseStd = glucoseVals.length > 1
    ? Math.sqrt(glucoseVals.reduce((s, v) => s + (v - glucoseAvg) ** 2, 0) / glucoseVals.length)
    : 10;
  const glucoseCv = glucoseAvg > 0 ? glucoseStd / glucoseAvg : 0.1;

  let cognitiveState: StateLevel = "moderate";
  const cogScore = (1 - clamp(glucoseCv, 0, 0.3) / 0.3) * 50 + (sleepScore / 100) * 50;
  if (cogScore >= 80) cognitiveState = "optimal";
  else if (cogScore >= 65) cognitiveState = "good";
  else if (cogScore >= 50) cognitiveState = "moderate";
  else if (cogScore >= 35) cognitiveState = "low";
  else cognitiveState = "critical";

  const [hrRecent] = await db
    .select({ value: biometricReadingsTable.value })
    .from(biometricReadingsTable)
    .where(and(userEq, eq(biometricReadingsTable.metric, "resting_hr"), gte(biometricReadingsTable.recordedAt, h24)))
    .orderBy(desc(biometricReadingsTable.recordedAt))
    .limit(1);
  const [hr7Row] = await db
    .select({ avg: avg(biometricReadingsTable.value) })
    .from(biometricReadingsTable)
    .where(and(userEq, eq(biometricReadingsTable.metric, "resting_hr"), gte(biometricReadingsTable.recordedAt, d7)));
  const currentRhr = hrRecent?.value ?? 60;
  const rhr7 = hr7Row?.avg != null ? parseFloat(String(hr7Row.avg)) : 60;

  let stressState: StateLevel = "moderate";
  const rhrRatio = rhr7 > 0 ? currentRhr / rhr7 : 1;
  const recoveryBonus = recoveryState === "optimal" ? 40 : recoveryState === "good" ? 30 : recoveryState === "moderate" ? 20 : 5;
  const stressScore = (1 - clamp(rhrRatio - 1, 0, 0.2) / 0.2) * 60 + recoveryBonus;
  if (stressScore >= 85) stressState = "optimal";
  else if (stressScore >= 68) stressState = "good";
  else if (stressScore >= 50) stressState = "moderate";
  else if (stressScore >= 35) stressState = "low";
  else stressState = "critical";

  const [latestActivity] = await db
    .select({ strainScore: activitySessionsTable.strainScore })
    .from(activitySessionsTable)
    .where(and(eq(activitySessionsTable.userId, userId), gte(activitySessionsTable.recordedAt, d7)))
    .orderBy(desc(activitySessionsTable.recordedAt))
    .limit(1);
  const strain = latestActivity?.strainScore ?? 10;

  let metabolicState: StateLevel = "moderate";
  const glucoseOptimal = glucoseAvg >= 80 && glucoseAvg <= 100;
  const metabolicScore = (glucoseOptimal ? 50 : clamp(1 - Math.abs(glucoseAvg - 90) / 50, 0, 1) * 50) + clamp(strain / 21, 0, 1) * 50;
  if (metabolicScore >= 80) metabolicState = "optimal";
  else if (metabolicScore >= 65) metabolicState = "good";
  else if (metabolicScore >= 50) metabolicState = "moderate";
  else if (metabolicScore >= 35) metabolicState = "low";
  else metabolicState = "critical";

  const stateToScore: Record<StateLevel, number> = { optimal: 100, good: 80, moderate: 60, low: 40, critical: 20 };
  const readinessScore = Math.round(
    stateToScore[energyState] * 0.25 +
    stateToScore[recoveryState] * 0.30 +
    stateToScore[cognitiveState] * 0.20 +
    stateToScore[stressState] * 0.15 +
    stateToScore[metabolicState] * 0.10,
  );

  const notes = `HRV: ${currentHrv.toFixed(0)}ms | Sleep eff: ${sleepEff.toFixed(0)}% | Glucose avg: ${glucoseAvg.toFixed(0)} mg/dL`;

  const [state] = await db
    .insert(biologicalStatesTable)
    .values({ userId, energyState, recoveryState, cognitiveState, stressState, metabolicState, readinessScore, notes })
    .returning();

  return state!;
}
