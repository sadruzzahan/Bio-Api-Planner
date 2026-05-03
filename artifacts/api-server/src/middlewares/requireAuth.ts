import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { encrypt, emailLookupHash } from "../lib/encryption";
import { recordAudit } from "../lib/audit";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      clerkUserId?: string;
      userRole?: string;
    }
  }
}

type InternalUser = { id: number; role: string };

/**
 * Bounded LRU-ish cache mapping Clerk user id -> internal user record.
 * Reset on the unlikely event a row is deleted (admin debugging) — caller can
 * restart the process. Cache is per-instance; horizontally scaled deployments
 * will see eventual consistency for role changes (acceptable for now since
 * role is set out-of-band from an admin tool).
 */
const CACHE_LIMIT = 5_000;
const clerkIdToInternal = new Map<string, InternalUser>();
function cacheSet(key: string, value: InternalUser): void {
  if (clerkIdToInternal.size >= CACHE_LIMIT) {
    const oldest = clerkIdToInternal.keys().next().value;
    if (oldest !== undefined) clerkIdToInternal.delete(oldest);
  }
  clerkIdToInternal.set(key, value);
}

async function findByClerkId(clerkUserId: string): Promise<InternalUser | null> {
  const rows = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function resolveInternalUser(
  clerkUserId: string,
  claimedRole?: string,
): Promise<InternalUser> {
  const cached = clerkIdToInternal.get(clerkUserId);
  if (cached) {
    // If Clerk just elevated this user to admin (or revoked it), reflect it
    // immediately without waiting for the cache to roll over.
    if (claimedRole && claimedRole !== cached.role) {
      await db
        .update(usersTable)
        .set({ role: claimedRole })
        .where(eq(usersTable.clerkId, clerkUserId));
      const updated = { id: cached.id, role: claimedRole };
      cacheSet(clerkUserId, updated);
      return updated;
    }
    return cached;
  }

  // Fast path: row already exists for this Clerk user.
  const existing = await findByClerkId(clerkUserId);
  if (existing) {
    if (claimedRole && claimedRole !== existing.role) {
      await db
        .update(usersTable)
        .set({ role: claimedRole })
        .where(eq(usersTable.clerkId, clerkUserId));
      existing.role = claimedRole;
    }
    cacheSet(clerkUserId, existing);
    return existing;
  }

  // Slow path: provision a new local user from Clerk profile.
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    // Phone/passkey-only Clerk users: bail out with 422 instead of 500. Front-end
    // can show a "please add an email" UX. We never want to invent a fake email.
    throw new AuthError(
      422,
      "Clerk account is missing a primary email address",
    );
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    primaryEmail.split("@")[0];

  // Pull role from Clerk publicMetadata when present so a freshly-promoted
  // admin's first request lands as admin without a manual DB edit.
  const metaRole =
    typeof (clerkUser.publicMetadata as { role?: unknown })?.role === "string"
      ? ((clerkUser.publicMetadata as { role: string }).role)
      : undefined;
  const initialRole = claimedRole ?? metaRole ?? "user";

  // Race-safe insert keyed on the unique clerk_id column. We deliberately do
  // NOT auto-rebind an existing row by email — that would let any signup with
  // a previously-used email take over that account's data. If the email is
  // already taken by a row with a different (or null) clerk_id, this insert
  // fails on the email-unique constraint and we surface 409.
  let inserted: { id: number; role: string } | undefined;
  try {
    const rows = await db
      .insert(usersTable)
      .values({
        clerkId: clerkUserId,
        email: primaryEmail,
        emailEncrypted: encrypt(primaryEmail),
        emailLookup: emailLookupHash(primaryEmail),
        name: displayName,
        role: initialRole,
      })
      .onConflictDoNothing({ target: usersTable.clerkId })
      .returning({ id: usersTable.id, role: usersTable.role });
    inserted = rows[0];
  } catch (err: unknown) {
    // Surface the email-unique violation distinctly. Pg error code 23505 = unique_violation.
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr?.code === "23505" && pgErr?.constraint?.includes("email")) {
      throw new AuthError(
        409,
        "An account with this email already exists. Please contact support to link your accounts.",
      );
    }
    throw err;
  }

  if (inserted) {
    cacheSet(clerkUserId, inserted);
    // First sign-in for this Clerk identity. Audit it asynchronously.
    void recordAudit({
      userId: inserted.id,
      action: "auth.signup",
      entity: "user",
      entityId: inserted.id,
    });
    return inserted;
  }

  // onConflictDoNothing matched (concurrent insert won the race) — re-select.
  const reread = await findByClerkId(clerkUserId);
  if (!reread) {
    throw new Error(`Failed to upsert user for clerk_id=${clerkUserId}`);
  }
  cacheSet(clerkUserId, reread);
  return reread;
}

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // Read role from session claims (forwarded from Clerk publicMetadata via
    // a JWT template) when available so requests are not gated on a slow
    // round-trip to clerkClient.users.getUser.
    const claims = (auth as unknown as { sessionClaims?: Record<string, unknown> })
      ?.sessionClaims;
    const claimsMeta = (claims?.publicMetadata ?? claims?.public_metadata) as
      | { role?: unknown }
      | undefined;
    const claimedRole =
      typeof claims?.role === "string"
        ? (claims.role as string)
        : typeof claimsMeta?.role === "string"
          ? (claimsMeta.role as string)
          : undefined;
    const internal = await resolveInternalUser(clerkUserId, claimedRole);
    req.userId = internal.id;
    req.clerkUserId = clerkUserId;
    req.userRole = internal.role;
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "requireAuth failed");
    res.status(500).json({ error: "Auth resolution failed" });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
