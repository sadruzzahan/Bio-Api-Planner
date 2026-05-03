import { purgeDeletedUsers } from "../routes/privacy";
import { runDueSyncs } from "./integration-sync";
import { logger } from "./logger";

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const SOFT_DELETE_GRACE_DAYS = 30;
// Wake every minute and pick up any integrations whose next_sync_at has
// fallen behind. The actual provider cadence is encoded per-adapter via
// `syncIntervalMs` and is what determines how often a given integration
// is actually re-polled — this interval is just the polling resolution.
const SYNC_TICK_MS = 60 * 1000;

/**
 * Lightweight in-process scheduler. Real production deployments should move
 * this to a proper job runner (Task: Background jobs & data pipeline). For
 * now, intervals give us the daily purge required by the compliance task
 * and per-integration polling required by the wearable/CGM task.
 */
export function startScheduledJobs(): void {
  const purgeTick = async () => {
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
  const syncTick = async () => {
    try {
      const ran = await runDueSyncs();
      if (ran > 0) logger.info({ ran }, "scheduled integration syncs completed");
    } catch (err) {
      logger.error({ err }, "scheduled integration sync tick failed");
    }
  };
  // Stagger first runs so the server can finish listening before either
  // hits the database hard.
  setTimeout(() => void purgeTick(), 30_000);
  setInterval(() => void purgeTick(), PURGE_INTERVAL_MS);
  setTimeout(() => void syncTick(), 15_000);
  setInterval(() => void syncTick(), SYNC_TICK_MS);
}
