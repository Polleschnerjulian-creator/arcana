import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse."),
});

// Always return the same message regardless of whether the email exists
const SUCCESS_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zuruecksetzen gesendet.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = forgotPasswordSchema.parse(body);
    const email = data.email.toLowerCase().trim();

    // Rate limit: 3 requests per email per hour
    const { success: rateLimitOk } = rateLimit(
      `forgot-password:${email}`,
      3,
      60 * 60 * 1000
    );

    if (!rateLimitOk) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut.",
        },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // Check if user exists (don't reveal if they don't)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      // Generate reset token
      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");

      // Store hashed token with 1-hour expiry
      await prisma.passwordReset.create({
        data: {
          email: user.email,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Build reset URL
      const baseUrl =
        process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${plainToken}`;

      // Send email
      await sendEmail({
        to: user.email,
        subject: "Passwort zuruecksetzen – ARCANA",
        html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif; background: #f5f5f7; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #1D1D1F; margin: 0;">Passwort zuruecksetzen</h1>
    </div>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
      Hallo ${user.name},<br><br>
      Sie haben angefordert, Ihr ARCANA-Passwort zurueckzusetzen. Klicken Sie auf den folgenden Link, um ein neues Passwort festzulegen:
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #1D1D1F; color: #fff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600;">
        Neues Passwort setzen
      </a>
    </div>
    <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
      Dieser Link ist 1 Stunde gueltig. Falls Sie diese Anfrage nicht gestellt haben, koennen Sie diese E-Mail ignorieren.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">
      ARCANA &middot; AI-native Buchhaltung
    </p>
  </div>
</body>
</html>`,
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGE,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validierungsfehler.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
