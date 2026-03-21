import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compare, hash } from "bcryptjs";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema ─────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Aktuelles Passwort ist erforderlich."),
  newPassword: z
    .string()
    .min(8, "Neues Passwort muss mindestens 8 Zeichen lang sein."),
});

// ─── PATCH: Change password ─────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(
      data.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Das aktuelle Passwort ist nicht korrekt." },
        { status: 400 }
      );
    }

    // Hash and update new password
    const newPasswordHash = await hash(data.newPassword, 12);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Create audit entry
    await createAuditEntry({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "USER",
      entityId: session.user.id,
      previousState: null,
      newState: { passwordChanged: true },
    });

    return NextResponse.json({
      success: true,
      message: "Passwort wurde erfolgreich geaendert.",
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

    console.error("Password change error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
