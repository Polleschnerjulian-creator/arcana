import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── PATCH: Update user role ────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "BOOKKEEPER", "VIEWER"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Only OWNER can change roles
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "OWNER") {
      return NextResponse.json(
        {
          success: false,
          error: "Nur der Inhaber kann Rollen aendern.",
        },
        { status: 403 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    // Cannot change OWNER role
    if (targetUser.role === "OWNER") {
      return NextResponse.json(
        {
          success: false,
          error: "Die Inhaberrolle kann nicht geaendert werden.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
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

    console.error("Error updating team member role:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove user from org ───────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Only OWNER can remove members
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "OWNER") {
      return NextResponse.json(
        {
          success: false,
          error: "Nur der Inhaber kann Mitglieder entfernen.",
        },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (id === session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sie koennen sich nicht selbst entfernen.",
        },
        { status: 400 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Benutzer nicht gefunden." },
        { status: 404 }
      );
    }

    // Cannot remove another OWNER
    if (targetUser.role === "OWNER") {
      return NextResponse.json(
        {
          success: false,
          error: "Der Inhaber kann nicht entfernt werden.",
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Mitglied wurde entfernt.",
    });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
