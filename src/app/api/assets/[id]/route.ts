import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema ─────────────────────────────────────────────────

const updateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  disposalDate: z.string().optional().nullable(),
  disposalPrice: z.number().min(0).optional().nullable(),
});

// ─── GET: Single Asset ──────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const asset = await prisma.fixedAsset.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Anlage nicht gefunden." },
        { status: 404 }
      );
    }

    const serialized = {
      ...asset,
      purchasePrice: Number(asset.purchasePrice),
      residualValue: Number(asset.residualValue),
      currentBookValue: Number(asset.currentBookValue),
      disposalPrice: asset.disposalPrice ? Number(asset.disposalPrice) : null,
      purchaseDate: asset.purchaseDate.toISOString(),
      disposalDate: asset.disposalDate?.toISOString() || null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update Asset ────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const existing = await prisma.fixedAsset.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Anlage nicht gefunden." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateAssetSchema.parse(body);

    const previousState = {
      name: existing.name,
      isActive: existing.isActive,
      disposalDate: existing.disposalDate?.toISOString() || null,
      disposalPrice: existing.disposalPrice
        ? Number(existing.disposalPrice)
        : null,
    };

    const updated = await prisma.fixedAsset.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.disposalDate !== undefined && {
          disposalDate: data.disposalDate ? new Date(data.disposalDate) : null,
        }),
        ...(data.disposalPrice !== undefined && {
          disposalPrice: data.disposalPrice,
        }),
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "ACCOUNT",
        entityId: updated.id,
        previousState,
        newState: {
          type: "FIXED_ASSET",
          name: updated.name,
          isActive: updated.isActive,
          disposalDate: updated.disposalDate?.toISOString() || null,
          disposalPrice: updated.disposalPrice
            ? Number(updated.disposalPrice)
            : null,
        },
      });
    } catch {
      // Non-blocking
    }

    const serialized = {
      ...updated,
      purchasePrice: Number(updated.purchasePrice),
      residualValue: Number(updated.residualValue),
      currentBookValue: Number(updated.currentBookValue),
      disposalPrice: updated.disposalPrice
        ? Number(updated.disposalPrice)
        : null,
      purchaseDate: updated.purchaseDate.toISOString(),
      disposalDate: updated.disposalDate?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: serialized });
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

    console.error("Error updating asset:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete Asset ───────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const existing = await prisma.fixedAsset.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Anlage nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.fixedAsset.delete({ where: { id } });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DELETE",
        entityType: "ACCOUNT",
        entityId: id,
        previousState: {
          type: "FIXED_ASSET",
          name: existing.name,
          purchasePrice: Number(existing.purchasePrice),
          currentBookValue: Number(existing.currentBookValue),
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
