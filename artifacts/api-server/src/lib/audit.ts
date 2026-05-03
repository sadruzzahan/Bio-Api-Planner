import type { Request } from "express";
import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "export"
  | "consent.accept"
  | "consent.revoke"
  | "account.delete.request"
  | "account.delete.cancel"
  | "account.delete.purge"
  | "auth.signin"
  | "auth.signup";

export interface AuditOptions {
  userId: number;
  action: AuditAction;
  entity: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
  actorId?: number;
  req?: Request;
}

/**
 * Append an audit-log row. Failures are logged but never thrown — auditing
 * must never take down a successful business write.
 */
export async function recordAudit(opts: AuditOptions): Promise<void> {
  const ip = opts.req
    ? (opts.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      opts.req.socket.remoteAddress ||
      undefined
    : undefined;
  const userAgent = opts.req
    ? (opts.req.headers["user-agent"] as string | undefined)
    : undefined;
  try {
    await db.insert(auditLogTable).values({
      userId: opts.userId,
      actorId: opts.actorId ?? opts.userId,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId == null ? null : String(opts.entityId),
      metadata: opts.metadata ?? null,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err, audit: { action: opts.action, entity: opts.entity } }, "audit log write failed");
  }
}
