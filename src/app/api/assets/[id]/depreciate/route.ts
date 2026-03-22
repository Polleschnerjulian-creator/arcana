import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { getDepreciationForYear } from "@/lib/accounting/afa";

// ─── POST: Book Depreciation for Current Year ──────────────────
//
// Erstellt eine AfA-Buchung:
//   Soll: 4830 Abschreibungen auf Sachanlagen
//   Haben: Anlagekonto (z.B. 0320, 0420)
//
// Aktualisiert den Buchwert der Anlage.

export async function POST(
  request: NextRequest,
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

    // Parse optional year from body (defaults to current year)
    let targetYear = new Date().getFullYear();
    try {
      const body = await request.json();
      if (body.year && typeof body.year === "number") {
        targetYear = body.year;
      }
    } catch {
      // No body or invalid JSON — use default year
    }

    // Fetch the asset
    const asset = await prisma.fixedAsset.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Anlage nicht gefunden." },
        { status: 404 }
      );
    }

    if (!asset.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Anlage ist bereits ausgeschieden. Keine AfA moeglich.",
        },
        { status: 400 }
      );
    }

    if (Number(asset.currentBookValue) <= Number(asset.residualValue)) {
      return NextResponse.json(
        {
          success: false,
          error: "Anlage ist bereits vollstaendig abgeschrieben.",
        },
        { status: 400 }
      );
    }

    // Check if depreciation was already booked for this year
    const existingBooking = await prisma.transaction.findFirst({
      where: {
        organizationId: session.user.organizationId,
        reference: `AFA-${targetYear}-${asset.id}`,
        status: { in: ["DRAFT", "BOOKED"] },
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        {
          success: false,
          error: `AfA fuer ${targetYear} wurde bereits gebucht.`,
        },
        { status: 400 }
      );
    }

    // Calculate depreciation amount for this year
    const depreciationAmount = getDepreciationForYear(
      {
        purchasePrice: Number(asset.purchasePrice),
        purchaseDate: asset.purchaseDate,
        usefulLifeYears: asset.usefulLifeYears,
        residualValue: Number(asset.residualValue),
        depreciationMethod: asset.depreciationMethod,
      },
      targetYear
    );

    if (depreciationAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Keine AfA fuer ${targetYear} berechenbar. Moeglicherweise liegt das Jahr ausserhalb der Nutzungsdauer.`,
        },
        { status: 400 }
      );
    }

    // Don't depreciate below residual value
    const maxDepreciation = Math.min(
      depreciationAmount,
      Number(asset.currentBookValue) - Number(asset.residualValue)
    );

    if (maxDepreciation <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Anlage ist bereits vollstaendig abgeschrieben.",
        },
        { status: 400 }
      );
    }

    // Find the depreciation expense account (4830 or 4970)
    // Try 4830 first (standard SKR03), then 4970
    let depreciationExpenseAccount = await prisma.account.findFirst({
      where: {
        organizationId: session.user.organizationId,
        number: { in: ["4830", "4970"] },
      },
    });

    if (!depreciationExpenseAccount) {
      // Create the account
      depreciationExpenseAccount = await prisma.account.create({
        data: {
          organizationId: session.user.organizationId,
          number: "4830",
          name: "Abschreibungen auf Sachanlagen",
          type: "EXPENSE",
          category: "AUFWAND",
          isSystem: true,
          isActive: true,
        },
      });
    }

    // Find the asset's linked account
    const assetAccount = await prisma.account.findFirst({
      where: {
        id: asset.accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!assetAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "Anlagekonto nicht gefunden.",
        },
        { status: 400 }
      );
    }

    // Create the depreciation transaction and update asset book value
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction: Debit 4830, Credit asset account
      const transaction = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: new Date(targetYear, 11, 31), // Dec 31 of target year
          description: `AfA ${targetYear}: ${asset.name} (${asset.depreciationMethod === "LINEAR" ? "linear" : "degressiv"})`,
          reference: `AFA-${targetYear}-${asset.id}`,
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: session.user.id,
          source: "MANUAL",
          lines: {
            create: [
              {
                accountId: depreciationExpenseAccount!.id,
                debit: maxDepreciation,
                credit: 0,
                note: `AfA ${asset.name}`,
              },
              {
                accountId: assetAccount.id,
                debit: 0,
                credit: maxDepreciation,
                note: `AfA ${asset.name}`,
              },
            ],
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, number: true, name: true } },
            },
          },
        },
      });

      // Update asset book value
      const newBookValue = roundCurrency(
        Number(asset.currentBookValue) - maxDepreciation
      );
      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: { currentBookValue: newBookValue },
      });

      return { transaction, newBookValue };
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BOOK",
        entityType: "TRANSACTION",
        entityId: result.transaction.id,
        newState: {
          type: "DEPRECIATION",
          assetId: asset.id,
          assetName: asset.name,
          year: targetYear,
          amount: maxDepreciation,
          newBookValue: result.newBookValue,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: result.transaction.id,
        depreciationAmount: maxDepreciation,
        newBookValue: result.newBookValue,
        year: targetYear,
      },
    });
  } catch (error) {
    console.error("Error booking depreciation:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
