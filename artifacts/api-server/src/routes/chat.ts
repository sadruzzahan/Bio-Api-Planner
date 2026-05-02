import { Router, type IRouter } from "express";
import { and, eq, gte, desc, asc } from "drizzle-orm";
import {
  db,
  chatMessagesTable,
  biologicalStatesTable,
  biometricReadingsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
  GetChatHistoryQueryParams,
  GetChatHistoryResponse,
} from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an elite personal biological intelligence agent. You have real-time access to the user's biometric data: HRV, sleep quality, glucose levels, activity strain, and multi-dimensional biological state classifications.

Your role:
- Interpret biometric patterns with scientific precision and practical clarity
- Give actionable, evidence-backed recommendations grounded in the user's actual data
- Speak like a knowledgeable coach who understands both the science and the human experience
- Reference specific numbers and trends from the provided context
- Keep responses concise and focused — 3-5 sentences unless the question demands more

You are NOT a general wellness chatbot. You are a precision optimization engine with access to real biological data.`;

router.post("/chat", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const body = SendChatMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentMessages, [currentState], recentBiometrics] = await Promise.all([
    db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, userId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(10),
    db.select().from(biologicalStatesTable)
      .where(eq(biologicalStatesTable.userId, userId))
      .orderBy(desc(biologicalStatesTable.computedAt))
      .limit(1),
    db.select().from(biometricReadingsTable)
      .where(and(eq(biometricReadingsTable.userId, userId), gte(biometricReadingsTable.recordedAt, h24)))
      .orderBy(desc(biometricReadingsTable.recordedAt))
      .limit(30),
  ]);

  const contextBlock = JSON.stringify({
    currentBiologicalState: currentState ?? null,
    last24hBiometrics: recentBiometrics,
  });

  const [userMsg] = await db
    .insert(chatMessagesTable)
    .values({ userId, role: "user", content: body.data.message })
    .returning();

  const chatHistory = recentMessages.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const aiMessages: { role: "user" | "assistant"; content: string }[] = [
    ...chatHistory,
    {
      role: "user",
      content: `[BIOMETRIC CONTEXT]\n${contextBlock}\n\n[USER MESSAGE]\n${body.data.message}`,
    },
  ];

  const aiResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: aiMessages,
  });

  const assistantText =
    aiResponse.content[0]?.type === "text"
      ? aiResponse.content[0].text
      : "I was unable to process that request.";

  const [assistantMsg] = await db
    .insert(chatMessagesTable)
    .values({
      userId,
      role: "assistant",
      content: assistantText,
      contextSnapshot: { state: currentState ?? null, biometricsCount: recentBiometrics.length },
    })
    .returning();

  res.json(SendChatMessageResponse.parse({ userMessage: userMsg, assistantMessage: assistantMsg }));
});

router.get("/chat/history", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const q = GetChatHistoryQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(asc(chatMessagesTable.createdAt))
    .limit(q.data.limit);
  res.json(GetChatHistoryResponse.parse(rows));
});

export default router;
