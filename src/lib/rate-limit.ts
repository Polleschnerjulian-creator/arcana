/**
 * Simple in-memory rate limiter for auth endpoints.
 *
 * NOTE: This resets on each deploy/cold start since it uses in-memory storage.
 * This is acceptable for Phase 1 — it still prevents automated brute-force
 * attacks within a single function lifecycle. For production scale, migrate
 * to a persistent store like Upstash Redis (@upstash/ratelimit).
 */

const attempts = new Map<string, { count: number; resetAt: number }>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  attempts.forEach((record, key) => {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  });
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  cleanupExpired();

  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}
