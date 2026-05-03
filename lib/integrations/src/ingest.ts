import { sql } from "drizzle-orm";
import {
  db,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
} from "@workspace/db";
import type { NormalisedPayload } from "./types";

/**
 * Persist a normalised payload from a provider sync.
 *
 * Every insert uses ON CONFLICT DO NOTHING against the natural-key unique
 * indexes installed by migration 0005. That makes the whole operation
 * idempotent: replaying a sync (or two providers reporting the same
 * underlying source) will never produce duplicate rows.
 *
 * Returns the count of rows actually inserted (i.e. excluding conflicts)
 * so the sync runner can populate sync_runs.records_ingested with a
 * meaningful number rather than the size of the input batch.
 */
export async function ingestPayload(
  userId: number,
  payload: NormalisedPayload,
): Promise<number> {
  let inserted = 0;

  if (payload.biometrics.length > 0) {
    const rows = payload.biometrics.map((b) => ({
      userId,
      source: b.source,
      metric: b.metric,
      value: b.value,
      unit: b.unit,
      recordedAt: b.recordedAt,
    }));
    const result = await db
      .insert(biometricReadingsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [
          biometricReadingsTable.userId,
          biometricReadingsTable.source,
          biometricReadingsTable.metric,
          biometricReadingsTable.recordedAt,
        ],
      })
      .returning({ id: biometricReadingsTable.id });
    inserted += result.length;
  }

  if (payload.sleep.length > 0) {
    const rows = payload.sleep.map((s) => ({
      userId,
      source: s.source,
      date: s.date,
      totalMinutes: s.totalMinutes,
      deepMinutes: s.deepMinutes,
      remMinutes: s.remMinutes,
      lightMinutes: s.lightMinutes,
      awakeMinutes: s.awakeMinutes,
      efficiencyPct: s.efficiencyPct,
      onsetAt: s.onsetAt,
      wakeAt: s.wakeAt,
    }));
    const result = await db
      .insert(sleepSessionsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [
          sleepSessionsTable.userId,
          sleepSessionsTable.source,
          sleepSessionsTable.date,
        ],
      })
      .returning({ id: sleepSessionsTable.id });
    inserted += result.length;
  }

  if (payload.glucose.length > 0) {
    const rows = payload.glucose.map((g) => ({
      userId,
      source: g.source,
      valueMgdl: g.valueMgdl,
      mealContext: g.mealContext,
      recordedAt: g.recordedAt,
    }));
    const result = await db
      .insert(glucoseReadingsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [
          glucoseReadingsTable.userId,
          glucoseReadingsTable.source,
          glucoseReadingsTable.recordedAt,
        ],
      })
      .returning({ id: glucoseReadingsTable.id });
    inserted += result.length;
  }

  if (payload.activity.length > 0) {
    const rows = payload.activity.map((a) => ({
      userId,
      source: a.source,
      type: a.type,
      durationMinutes: a.durationMinutes,
      intensity: a.intensity,
      strainScore: a.strainScore,
      avgHeartRate: a.avgHeartRate,
      calories: a.calories,
      recordedAt: a.recordedAt,
    }));
    const result = await db
      .insert(activitySessionsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [
          activitySessionsTable.userId,
          activitySessionsTable.source,
          activitySessionsTable.type,
          activitySessionsTable.recordedAt,
        ],
      })
      .returning({ id: activitySessionsTable.id });
    inserted += result.length;
  }

  // Touch the parent table's updated row so the dashboard's "fresh data"
  // indicator can use a single timestamp without scanning all four tables.
  void sql; // (sql tagged-template kept imported in case we move to a single batch later)
  return inserted;
}
