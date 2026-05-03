import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { recordAudit } from "../lib/audit";

/**
 * Read-only profile endpoints. Mounted ABOVE the consent gate so a
 * not-yet-consented user can fetch their account state (used by the
 * frontend modal to show name/email when prompting for acceptance).
 *
 * No mutation routes belong here — see usersWriteRouter for those.
 */
export const usersReadRouter: IRouter = Router();

usersReadRouter.get("/users/me", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(user));
});

/**
 * Mutating profile endpoints. Mounted BELOW the consent gate — a user
 * cannot edit profile fields (including onboardedAt) without first
 * having recorded acceptance for every required legal document.
 */
export const usersWriteRouter: IRouter = Router();

usersWriteRouter.patch("/users/me", async (req, res): Promise<void> => {
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

// Default export keeps backward compatibility with prior imports — points to
// the read-only router so accidental pre-consent usage cannot expose writes.
export default usersReadRouter;
