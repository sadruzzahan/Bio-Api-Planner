import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/users/me", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(user));
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { onboardedAt, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (onboardedAt !== undefined) {
    updates.onboardedAt = onboardedAt === null ? null : new Date(onboardedAt);
  }

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await recordAudit({
    userId,
    action: "update",
    entity: "user",
    entityId: userId,
    metadata: { fields: Object.keys(updates) },
    req,
  });
  res.json(UpdateCurrentUserResponse.parse(user));
});

export default router;
