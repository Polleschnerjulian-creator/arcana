import { NextRequest } from "next/server";

export function validateOrigin(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) return true; // Allow non-browser clients (curl, etc.)

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}
