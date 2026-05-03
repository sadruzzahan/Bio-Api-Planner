import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, consentRecordsTable } from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { invalidateConsentCache } from "../middlewares/requireConsent";

const router: IRouter = Router();

const VALID_DOCUMENTS = new Set(["tos", "privacy", "disclaimer", "cookies"]);

router.get("/consent", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select()
    .from(consentRecordsTable)
    .where(eq(consentRecordsTable.userId, userId))
    .orderBy(desc(consentRecordsTable.acceptedAt));
  res.json({ records: rows });
});

router.post("/consent", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const body = req.body as {
    document?: unknown;
    version?: unknown;
    accepted?: unknown;
    categories?: unknown;
  };
  if (typeof body.document !== "string" || !VALID_DOCUMENTS.has(body.document)) {
    res.status(400).json({ error: "Invalid document" });
    return;
  }
  if (typeof body.version !== "string" || body.version.length === 0) {
    res.status(400).json({ error: "Invalid version" });
    return;
  }
  const accepted = body.accepted === undefined ? true : Boolean(body.accepted);

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

  const [row] = await db
    .insert(consentRecordsTable)
    .values({
      userId,
      document: body.document,
      version: body.version,
      accepted,
      categories: (body.categories as Record<string, unknown> | undefined) ?? null,
      ip,
      userAgent,
    })
    .returning();

  await recordAudit({
    userId,
    action: accepted ? "consent.accept" : "consent.revoke",
    entity: `consent.${body.document}`,
    entityId: row?.id,
    metadata: { version: body.version },
    req,
  });

  // Invalidate the per-process consent cache so the next request from
  // this user re-evaluates the gate against the freshly-recorded row.
  invalidateConsentCache(userId);

  res.status(201).json(row);
});

export default router;
