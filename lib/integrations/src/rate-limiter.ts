import type { ProviderId, RateLimiter } from "./types";

/**
 * Token bucket. Each provider gets its own bucket. We use floating-point
 * tokens so fractional refill works cleanly, and `await`-yield via
 * setTimeout when the caller is over budget. Process-local: horizontal
 * scaling will eventually require pushing this into Redis (Task #11).
 */
interface Bucket {
  capacity: number;
  refillPerSecond: number;
  tokens: number;
  updatedAt: number;
}

const buckets: Record<ProviderId, Bucket> = {
  // Conservative defaults derived from each provider's published quota.
  // Numbers err on the low side — we'd rather be slow than rate-limited.
  whoop:   { capacity: 30, refillPerSecond: 0.5, tokens: 30, updatedAt: 0 },
  oura:    { capacity: 60, refillPerSecond: 1.0, tokens: 60, updatedAt: 0 },
  fitbit:  { capacity: 60, refillPerSecond: 1.0, tokens: 60, updatedAt: 0 },
  garmin:  { capacity: 30, refillPerSecond: 0.5, tokens: 30, updatedAt: 0 },
  dexcom:  { capacity: 60, refillPerSecond: 1.0, tokens: 60, updatedAt: 0 },
};

function refill(b: Bucket): void {
  const now = Date.now();
  if (b.updatedAt === 0) {
    b.updatedAt = now;
    return;
  }
  const elapsedSec = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(b.capacity, b.tokens + elapsedSec * b.refillPerSecond);
  b.updatedAt = now;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const tokenBucket: RateLimiter = {
  async take(provider: ProviderId): Promise<void> {
    const b = buckets[provider];
    // Loop because between sleeping and re-checking another caller may have
    // raced us to the last token.
    for (;;) {
      refill(b);
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return;
      }
      const needed = 1 - b.tokens;
      const waitMs = Math.ceil((needed / b.refillPerSecond) * 1000);
      await sleep(Math.max(50, Math.min(waitMs, 5_000)));
    }
  },
};

/** Test/utility: reset all buckets to full. */
export function resetRateLimiters(): void {
  for (const id of Object.keys(buckets) as ProviderId[]) {
    buckets[id].tokens = buckets[id].capacity;
    buckets[id].updatedAt = 0;
  }
}
