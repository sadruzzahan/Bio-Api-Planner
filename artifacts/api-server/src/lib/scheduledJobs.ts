import { purgeDeletedUsers } from "../routes/privacy";
import { logger } from "./logger";

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const SOFT_DELETE_GRACE_DAYS = 30;

/**
 * Lightweight in-process scheduler. Real production deployments should move
 * this to a proper job runner (Task: Background jobs & data pipeline). For
 * now, an interval gives us the daily purge required by the compliance task.
 */
export function startScheduledJobs(): void {
  const tick = async () => {
    const cutoff = new Date(Date.now() - SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    try {
      const purged = await purgeDeletedUsers(cutoff);
      if (purged > 0) {
        logger.info({ purged, cutoff: cutoff.toISOString() }, "purged soft-deleted users");
      }
    } catch (err) {
      logger.error({ err }, "scheduled purge failed");
    }
  };
  // Kick off once at boot (after a small delay so the server can finish
  // listening), then every interval.
  setTimeout(() => void tick(), 30_000);
  setInterval(() => void tick(), PURGE_INTERVAL_MS);
}
