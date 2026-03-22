import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// ─── GET: List team members ─────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: [
        { role: "asc" }, // OWNER first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error listing team members:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Invite new team member ──────────────────────────────

const inviteSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse."),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein."),
  role: z.enum(["ADMIN", "BOOKKEEPER", "VIEWER"]),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can invite
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !["OWNER", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Nur Inhaber und Administratoren koennen Mitglieder einladen.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = inviteSchema.parse(body);
    const email = data.email.toLowerCase().trim();

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Ein Benutzer mit dieser E-Mail existiert bereits.",
        },
        { status: 409 }
      );
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
    const passwordHash = await hash(tempPassword, 12);

    // Get organization name for the email
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    });

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: data.name,
        passwordHash,
        role: data.role,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Send invitation email
    const loginUrl =
      (process.env.NEXTAUTH_URL || "http://localhost:3000") + "/login";

    await sendEmail({
      to: email,
      subject: `Einladung zu ${org?.name || "ARCANA"}`,
      html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif; background: #f5f5f7; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #1D1D1F; margin: 0;">Willkommen bei ARCANA</h1>
    </div>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
      Hallo ${data.name},<br><br>
      Sie wurden von ${session.user.name || "Ihrem Team"} zu <strong>${org?.name || "ARCANA"}</strong> eingeladen.
      Hier sind Ihre Zugangsdaten:
    </p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">E-Mail</div>
      <div style="font-size: 14px; color: #1D1D1F; font-weight: 500; margin-bottom: 12px;">${email}</div>
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Temporaeres Passwort</div>
      <div style="font-size: 14px; color: #1D1D1F; font-family: monospace; font-weight: 500;">${tempPassword}</div>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #1D1D1F; color: #fff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600;">
        Jetzt anmelden
      </a>
    </div>
    <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
      Bitte aendern Sie Ihr Passwort nach der ersten Anmeldung unter Einstellungen &gt; Benutzer.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">
      ARCANA &middot; AI-native Buchhaltung
    </p>
  </div>
</body>
</html>`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newUser,
          createdAt: newUser.createdAt.toISOString(),
        },
        tempPassword,
      },
      { status: 201 }
    );
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

    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
