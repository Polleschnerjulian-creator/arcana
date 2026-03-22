import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token ist erforderlich."),
  password: z
    .string()
    .min(12, "Passwort muss mindestens 12 Zeichen lang sein."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = resetPasswordSchema.parse(body);

    // Hash the provided token to look it up
    const tokenHash = crypto
      .createHash("sha256")
      .update(data.token)
      .digest("hex");

    // Find a valid, unused reset token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!resetRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Link ist ungueltig oder abgelaufen.",
        },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Benutzer nicht gefunden.",
        },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const newPasswordHash = await hash(data.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Passwort wurde erfolgreich zurueckgesetzt.",
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

    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
