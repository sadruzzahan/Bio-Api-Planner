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
import { GetInsightsResponse } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

type UUID = `${string}-${string}-${string}-${string}-${string}`;

interface InsightCard {
  id: UUID;
  title: string;
  body: string;
  category: string;
  severity: string;
  createdAt: Date;
}

function fallbackInsights(): InsightCard[] {
  const now = new Date();
  return [
    { id: randomUUID() as UUID, title: "Continue logging for deeper insights", body: "More biometric data will unlock pattern-based recommendations tailored to your biology.", category: "recovery", severity: "info", createdAt: now },
    { id: randomUUID() as UUID, title: "Sleep quality tracking active", body: "Your sleep sessions are being monitored and staged for recovery trend analysis.", category: "sleep", severity: "info", createdAt: now },
    { id: randomUUID() as UUID, title: "Glucose monitoring nominal", body: "Continuous glucose data is being collected and analyzed for daily variability trends.", category: "glucose", severity: "info", createdAt: now },
  ];
}

export async function generateInsightCards(userId: number): Promise<InsightCard[]> {
  const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [biometrics, sleep, glucose, activity, stateRows] = await Promise.all([
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

  let anthropicClient: { messages: { create: Function } } | null = null;
  try {
    const mod = await import("@workspace/integrations-anthropic-ai");
    anthropicClient = mod.getAnthropicClient();
  } catch {
    return fallbackInsights();
  }

  const context = JSON.stringify({
    currentState: stateRows[0] ?? null,
    recentBiometrics: biometrics.slice(0, 20),
    sleepSessions: sleep,
    glucoseReadings: glucose.slice(0, 20),
    activitySessions: activity,
  });

  try {
    const message = await anthropicClient.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a biological intelligence system. Analyze the following 7-day biometric context and generate exactly 3 insight cards. Each card must be a JSON object with: title (short, action-oriented, max 8 words), body (2-3 sentences with specific numbers from the data), category (one of: recovery, sleep, glucose, activity, stress, metabolic), severity (one of: info, warning, critical).

Return ONLY a JSON array of exactly 3 objects, nothing else.

Context: ${context}`,
        },
      ],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "[]";
    let raw: Omit<InsightCard, "id" | "createdAt">[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) raw = JSON.parse(jsonMatch[0]);
    } catch {
      return fallbackInsights();
    }

    const now = new Date();
    const cards: InsightCard[] = raw.slice(0, 3).map((c) => ({
      id: randomUUID() as UUID,
      title: String(c.title || "Biometric Insight"),
      body: String(c.body || ""),
      category: String(c.category || "recovery"),
      severity: String(c.severity || "info"),
      createdAt: now,
    }));

    const fallbacks = fallbackInsights();
    while (cards.length < 3) {
      cards.push(fallbacks[cards.length]!);
    }

    return cards;
  } catch {
    return fallbackInsights();
  }
}

router.get("/insights", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const insights = await generateInsightCards(userId);
  res.json(GetInsightsResponse.parse(insights));
});

export default router;
