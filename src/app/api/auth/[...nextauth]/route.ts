import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

// GET is used for session checks, CSRF tokens, etc. — no rate limiting needed.
export { handler as GET };

// POST handles sign-in attempts — apply rate limiting.
export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  // Rate limiting: 10 attempts per IP per 15 minutes
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";

  // Only rate-limit the actual sign-in callback, not other NextAuth POST endpoints
  const { nextauth } = await context.params;
  const isSignIn = nextauth.includes("callback") || nextauth.includes("signin");

  if (isSignIn) {
    const { success: rateLimitOk } = rateLimit(
      `login:${ip}`,
      10,
      15 * 60 * 1000
    );

    if (!rateLimitOk) {
      return NextResponse.json(
        {
          success: false,
          error: "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.",
        },
        {
          status: 429,
          headers: { "Retry-After": "900" },
        }
      );
    }
  }

  // Delegate to NextAuth handler
  return handler(request, context);
}
