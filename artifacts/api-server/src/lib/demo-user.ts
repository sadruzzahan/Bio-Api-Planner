import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

let cachedUserId: number | null = null;

export async function getDemoUserId(): Promise<number> {
  if (cachedUserId !== null) return cachedUserId;
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "alex@biohack.io"))
    .limit(1);
  if (!user) throw new Error("Demo user not found — run the seed script first");
  cachedUserId = user.id;
  return cachedUserId;
}

export function clearDemoUserCache() {
  cachedUserId = null;
}
