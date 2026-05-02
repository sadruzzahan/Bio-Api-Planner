import { Router, type IRouter } from "express";
import { and, eq, gte, desc } from "drizzle-orm";
import {
  db,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
  biologicalStatesTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GetInsightsResponse } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const DEMO_USER_ID = 1;

interface InsightCard {
  id: string;
  title: string;
  body: string;
  category: string;
  severity: string;
  createdAt: Date;
}

async function generateInsights(userId: number): Promise<InsightCard[]> {
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [biometrics, sleep, glucose, activity, state] = await Promise.all([
    db.select().from(biometricReadingsTable)
      .where(and(eq(biometricReadingsTable.userId, userId), gte(biometricReadingsTable.recordedAt, d7)))
      .orderBy(desc(biometricReadingsTable.recordedAt)).limit(50),
    db.select().from(sleepSessionsTable)
      .where(and(eq(sleepSessionsTable.userId, userId), gte(sleepSessionsTable.onsetAt, d7)))
      .orderBy(desc(sleepSessionsTable.date)).limit(7),
    db.select().from(glucoseReadingsTable)
      .where(and(eq(glucoseReadingsTable.userId, userId), gte(glucoseReadingsTable.recordedAt, d7)))
      .orderBy(desc(glucoseReadingsTable.recordedAt)).limit(50),
    db.select().from(activitySessionsTable)
      .where(and(eq(activitySessionsTable.userId, userId), gte(activitySessionsTable.recordedAt, d7)))
      .orderBy(desc(activitySessionsTable.recordedAt)).limit(7),
    db.select().from(biologicalStatesTable)
      .where(eq(biologicalStatesTable.userId, userId))
      .orderBy(desc(biologicalStatesTable.computedAt)).limit(1),
  ]);

  const context = JSON.stringify({
    currentState: state[0] ?? null,
    recentBiometrics: biometrics.slice(0, 20),
    sleepSessions: sleep,
    glucoseReadings: glucose.slice(0, 20),
    activitySessions: activity,
  });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a biological intelligence system. Analyze the following 7-day biometric context and generate exactly 3 insight cards. Each card must be a JSON object with: title (short, action-oriented), body (2-3 sentences with specific numbers from the data), category (one of: recovery, sleep, glucose, activity, stress, metabolic), severity (one of: info, warning, critical).

Return ONLY a JSON array of 3 objects. No other text.

Context: ${context}`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "[]";

  let cards: Omit<InsightCard, "id" | "createdAt">[] = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) cards = JSON.parse(jsonMatch[0]);
  } catch {
    cards = [
      {
        title: "Biometric analysis complete",
        body: "Your biometric data has been processed. Continue logging for deeper insights.",
        category: "recovery",
        severity: "info",
      },
    ];
  }

  const now = new Date();
  return cards.slice(0, 3).map((c) => ({
    id: randomUUID(),
    title: c.title || "Insight",
    body: c.body || "",
    category: c.category || "recovery",
    severity: c.severity || "info",
    createdAt: now,
  }));
}

router.get("/insights", async (req, res): Promise<void> => {
  const insights = await generateInsights(DEMO_USER_ID);
  res.json(GetInsightsResponse.parse(insights));
});

export default router;
