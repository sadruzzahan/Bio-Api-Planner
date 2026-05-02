import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { getDemoUserId } from "../lib/demo-user";

const router: IRouter = Router();

router.get("/users/me", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(user));
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const userId = await getDemoUserId();
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateCurrentUserResponse.parse(user));
});

export default router;
