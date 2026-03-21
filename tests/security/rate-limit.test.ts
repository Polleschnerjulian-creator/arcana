import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("first request succeeds with remaining = limit - 1", () => {
    const key = `test-first-${Date.now()}-${Math.random()}`;
    const result = rateLimit(key, 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("requests within limit all succeed", () => {
    const key = `test-within-${Date.now()}-${Math.random()}`;
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      const result = rateLimit(key, limit, 60_000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(limit - 1 - i);
    }
  });

  it("request exceeding limit returns success: false", () => {
    const key = `test-exceed-${Date.now()}-${Math.random()}`;
    const limit = 2;

    // Exhaust the limit
    rateLimit(key, limit, 60_000);
    rateLimit(key, limit, 60_000);

    // This one should fail
    const result = rateLimit(key, limit, 60_000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("counter resets after window expires", async () => {
    const key = `test-reset-${Date.now()}-${Math.random()}`;
    const windowMs = 100;
    const limit = 1;

    // Use up the limit
    const first = rateLimit(key, limit, windowMs);
    expect(first.success).toBe(true);

    // Should fail immediately
    const second = rateLimit(key, limit, windowMs);
    expect(second.success).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

    // Should succeed again
    const third = rateLimit(key, limit, windowMs);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("different keys have independent limits", () => {
    const keyA = `test-indep-a-${Date.now()}-${Math.random()}`;
    const keyB = `test-indep-b-${Date.now()}-${Math.random()}`;
    const limit = 1;

    const resultA = rateLimit(keyA, limit, 60_000);
    expect(resultA.success).toBe(true);

    // keyA is now exhausted
    const resultA2 = rateLimit(keyA, limit, 60_000);
    expect(resultA2.success).toBe(false);

    // keyB should still work
    const resultB = rateLimit(keyB, limit, 60_000);
    expect(resultB.success).toBe(true);
  });

  it("same key shares the limit across calls", () => {
    const key = `test-shared-${Date.now()}-${Math.random()}`;
    const limit = 3;

    rateLimit(key, limit, 60_000); // 1 of 3
    rateLimit(key, limit, 60_000); // 2 of 3

    const result = rateLimit(key, limit, 60_000); // 3 of 3
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);

    // 4th call should fail
    const overflow = rateLimit(key, limit, 60_000);
    expect(overflow.success).toBe(false);
    expect(overflow.remaining).toBe(0);
  });
});
