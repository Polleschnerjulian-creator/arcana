import { describe, it, expect } from "vitest";
import { validateOrigin } from "@/lib/csrf";
import { NextRequest } from "next/server";

function createMockRequest(
  method: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("https://example.com/api/test", {
    method,
    headers,
  });
}

describe("validateOrigin", () => {
  it("GET request is always allowed (skipped)", () => {
    const req = createMockRequest("GET");
    expect(validateOrigin(req)).toBe(true);
  });

  it("HEAD request is always allowed", () => {
    const req = createMockRequest("HEAD");
    expect(validateOrigin(req)).toBe(true);
  });

  it("POST with matching origin returns true", () => {
    const req = createMockRequest("POST", {
      origin: "https://example.com",
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it("POST with different origin returns false", () => {
    const req = createMockRequest("POST", {
      origin: "https://evil.com",
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it("POST with no origin header returns true (non-browser clients)", () => {
    const req = createMockRequest("POST", {
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it("POST with malformed origin returns false", () => {
    const req = createMockRequest("POST", {
      origin: "not-a-valid-url",
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it('origin "https://example.com" with host "example.com" returns true', () => {
    const req = createMockRequest("POST", {
      origin: "https://example.com",
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it('origin "https://evil.com" with host "example.com" returns false', () => {
    const req = createMockRequest("POST", {
      origin: "https://evil.com",
      host: "example.com",
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it('origin with port "https://localhost:3000" with host "localhost:3000" returns true', () => {
    const req = createMockRequest("POST", {
      origin: "https://localhost:3000",
      host: "localhost:3000",
    });
    expect(validateOrigin(req)).toBe(true);
  });
});
