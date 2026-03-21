import { describe, it, expect } from "vitest";
import { generateApiKey } from "@/lib/api-auth";
import crypto from "crypto";

describe("generateApiKey", () => {
  it("returns object with key, keyHash, and keyPrefix", () => {
    const result = generateApiKey();
    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("keyHash");
    expect(result).toHaveProperty("keyPrefix");
  });

  it('key starts with "arc_"', () => {
    const { key } = generateApiKey();
    expect(key.startsWith("arc_")).toBe(true);
  });

  it("keyPrefix is the first 12 characters of the key", () => {
    const { key, keyPrefix } = generateApiKey();
    expect(keyPrefix).toBe(key.slice(0, 12));
    expect(keyPrefix).toHaveLength(12);
  });

  it("keyHash is a 64-character hex string (SHA-256)", () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toHaveLength(64);
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two calls return different keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.keyHash).not.toBe(b.keyHash);
    expect(a.keyPrefix).not.toBe(b.keyPrefix);
  });

  it("keyHash is deterministic for the same key (manual verification)", () => {
    const { key, keyHash } = generateApiKey();
    const manualHash = crypto
      .createHash("sha256")
      .update(Buffer.from(key))
      .digest("hex");
    expect(keyHash).toBe(manualHash);
  });
});
