import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema ─────────────────────────────────────────────────

const createAssetSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(200),
  description: z.string().optional().nullable(),
  accountId: z.string().min(1, "Anlagekonto ist erforderlich."),
  purchaseDate: z.string().min(1, "Anschaffungsdatum ist erforderlich."),
  purchasePrice: z.number().positive("Anschaffungskosten muessen positiv sein."),
  usefulLifeYears: z
    .number()
    .int()
    .min(1, "Nutzungsdauer muss mindestens 1 Jahr betragen."),
  depreciationMethod: z.enum(["LINEAR", "DEGRESSIVE"]).default("LINEAR"),
  residualValue: z.number().min(0).default(0),
});

// ─── GET: List Fixed Assets ─────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const assets = await prisma.fixedAsset.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    });

    // Serialize Decimal fields
    const serialized = assets.map((asset) => ({
      ...asset,
      purchasePrice: Number(asset.purchasePrice),
      residualValue: Number(asset.residualValue),
      currentBookValue: Number(asset.currentBookValue),
      disposalPrice: asset.disposalPrice ? Number(asset.disposalPrice) : null,
      purchaseDate: asset.purchaseDate.toISOString(),
      disposalDate: asset.disposalDate?.toISOString() || null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create Fixed Asset ───────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = createAssetSchema.parse(body);

    // Verify accountId belongs to the organization
    const account = await prisma.account.findFirst({
      where: {
        id: data.accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "Anlagekonto nicht gefunden oder gehoert nicht zu Ihrer Organisation.",
        },
        { status: 400 }
      );
    }

    // Residual value cannot exceed purchase price
    if (data.residualValue >= data.purchasePrice) {
      return NextResponse.json(
        {
          success: false,
          error: "Der Restwert muss kleiner als die Anschaffungskosten sein.",
        },
        { status: 400 }
      );
    }

    const asset = await prisma.fixedAsset.create({
      data: {
        organizationId: session.user.organizationId,
        name: data.name,
        description: data.description || null,
        accountId: data.accountId,
        purchaseDate: new Date(data.purchaseDate),
        purchasePrice: data.purchasePrice,
        usefulLifeYears: data.usefulLifeYears,
        depreciationMethod: data.depreciationMethod,
        residualValue: data.residualValue,
        currentBookValue: data.purchasePrice, // Starts at purchase price
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "ACCOUNT",
        entityId: asset.id,
        newState: {
          type: "FIXED_ASSET",
          name: asset.name,
          purchasePrice: Number(asset.purchasePrice),
          usefulLifeYears: asset.usefulLifeYears,
          depreciationMethod: asset.depreciationMethod,
        },
      });
    } catch {
      // Non-blocking
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

    return NextResponse.json(
      { success: true, data: serialized },
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

    console.error("Error creating asset:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
