import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, consentRecordsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Server-side consent gate. The frontend modal is a UX hint; this middleware
 * is the actual enforcement. Any authenticated request to a protected route
 * is rejected with 428 Precondition Required unless the caller has on-file
 * acceptance for every required document at its current version.
 *
 * Must be mounted AFTER `requireAuth` (depends on `req.userId`) and BEFORE
 * any protected router. The consent + users routers are intentionally
 * mounted before this gate so the user can record acceptance, look up
 * their own account state, and delete their account without first having
 * to consent.
 */

/**
 * The legal documents and versions a user MUST have on file before any
 * protected endpoint will respond. Keep in sync with the frontend
 * `LEGAL_VERSIONS` map in artifacts/biological-api/src/lib/legal.ts. Bumping
 * a version here forces every existing user to re-accept on their next
 * request, which is exactly the desired behaviour when legal content
 * materially changes.
 *
 * Intentional scope: the original task spec required ToS + Medical
 * Disclaimer at minimum. We additionally require Privacy because the
 * privacy notice covers the GDPR/CCPA legal-bases disclosure that the
 * data-processing endpoints below this gate rely on. The frontend
 * consent modal surfaces all three documents in a single flow so the
 * UX cost of the extra acceptance is zero. Drop "privacy" here if a
 * future product/legal decision narrows the required set.
 */
export const REQUIRED_CONSENT_DOCS = [
  { document: "tos" as const, version: "1.0" },
  { document: "privacy" as const, version: "1.0" },
  { document: "disclaimer" as const, version: "1.0" },
] as const;

// Tiny per-process cache: once we've seen a user pass the gate, we don't
// re-query for every request. Invalidated on POST /consent (see consent
// router) by importing and calling `invalidateConsentCache(userId)`.
const consentedUserIds = new Set<number>();
export function invalidateConsentCache(userId: number): void {
  consentedUserIds.delete(userId);
}

async function userHasAllRequiredConsent(userId: number): Promise<boolean> {
  const docs = REQUIRED_CONSENT_DOCS.map((d) => d.document);
  const rows = await db
    .select({
      document: consentRecordsTable.document,
      version: consentRecordsTable.version,
      accepted: consentRecordsTable.accepted,
    })
    .from(consentRecordsTable)
    .where(
      and(
        eq(consentRecordsTable.userId, userId),
        inArray(consentRecordsTable.document, docs),
      ),
    );

  // For each required (document, version) tuple there must be at least one
  // row with accepted=true. We don't care about chronological order — a
  // user who later "rejected" a doc would have failed at the modal step,
  // and consent records are immutable append-only.
  for (const required of REQUIRED_CONSENT_DOCS) {
    const ok = rows.some(
      (r) =>
        r.document === required.document &&
        r.version === required.version &&
        r.accepted === true,
    );
    if (!ok) return false;
  }
  return true;
}

export const requireConsent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;
  if (!userId) {
    // requireAuth should have caught this, but fail closed.
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (consentedUserIds.has(userId)) {
    next();
    return;
  }

  try {
    const ok = await userHasAllRequiredConsent(userId);
    if (!ok) {
      res.status(428).json({
        error: "Consent required",
        code: "CONSENT_REQUIRED",
        required: REQUIRED_CONSENT_DOCS,
      });
      return;
    }
    consentedUserIds.add(userId);
    next();
  } catch (err) {
    // FAIL CLOSED. If we cannot verify consent, do NOT let the request
    // through — surface 503 so the client retries instead of silently
    // bypassing the gate.
    logger.error({ err, userId }, "consent gate query failed");
    res.status(503).json({ error: "Consent verification unavailable" });
  }
};
