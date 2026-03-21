import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const updateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name ist erforderlich.")
    .max(100, "Name darf maximal 100 Zeichen lang sein.")
    .optional(),
  permissions: z
    .enum(["webhook", "full_read", "full_write"], {
      message: "Berechtigung muss 'webhook', 'full_read' oder 'full_write' sein.",
    })
    .optional(),
});

// ─── DELETE: Revoke API Key ─────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung. Nur Eigentümer und Administratoren können API-Schlüssel widerrufen." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify the key belongs to the user's organization
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API-Schlüssel nicht gefunden." },
        { status: 404 }
      );
    }

    if (!apiKey.isActive) {
      return NextResponse.json(
        { success: false, error: "API-Schlüssel ist bereits deaktiviert." },
        { status: 400 }
      );
    }

    // Soft-delete: set isActive to false (keep record for audit trail)
    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DELETE",
        entityType: "ORGANIZATION",
        entityId: id,
        previousState: {
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          isActive: true,
        },
        newState: {
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          isActive: false,
        },
      });
    } catch {
      // Audit failure should not break the flow
    }

    return NextResponse.json({
      success: true,
      message: "API-Schlüssel wurde widerrufen.",
    });
  } catch (error) {
    console.error("API Key DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update API Key ──────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateApiKeySchema.parse(body);

    // Verify the key belongs to the user's organization
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API-Schlüssel nicht gefunden." },
        { status: 404 }
      );
    }

    if (!apiKey.isActive) {
      return NextResponse.json(
        { success: false, error: "Deaktivierte API-Schlüssel können nicht bearbeitet werden." },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Keine Änderungen angegeben." },
        { status: 400 }
      );
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "ORGANIZATION",
        entityId: id,
        previousState: {
          name: apiKey.name,
          permissions: apiKey.permissions,
        },
        newState: {
          name: updated.name,
          permissions: updated.permissions,
        },
      });
    } catch {
      // Audit failure should not break the flow
    }

    return NextResponse.json({ success: true, data: updated });
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

    console.error("API Key PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
