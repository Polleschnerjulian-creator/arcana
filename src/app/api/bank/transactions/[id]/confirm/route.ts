import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Confirm AI-Suggested Match ────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Bankbewegung laden
    const bankTransaction = await prisma.bankTransaction.findFirst({
      where: {
        id: params.id,
        bankAccount: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!bankTransaction) {
      return NextResponse.json(
        { success: false, error: "Bankbewegung nicht gefunden." },
        { status: 404 }
      );
    }

    // Nur AI_SUGGESTED-Status kann bestätigt werden
    if (bankTransaction.matchStatus !== "AI_SUGGESTED") {
      return NextResponse.json(
        {
          success: false,
          error: `Nur KI-Vorschläge können bestätigt werden. Aktueller Status: ${bankTransaction.matchStatus}.`,
        },
        { status: 400 }
      );
    }

    if (!bankTransaction.matchedTransactionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Keine zugeordnete Transaktion vorhanden.",
        },
        { status: 400 }
      );
    }

    // Status auf CONFIRMED setzen
    const updated = await prisma.bankTransaction.update({
      where: { id: params.id },
      data: {
        matchStatus: "CONFIRMED",
      },
      include: {
        bankAccount: {
          select: { id: true, name: true },
        },
        matchedTransaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            status: true,
          },
        },
      },
    });

    // Audit-Eintrag
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "BANK_TRANSACTION",
        entityId: params.id,
        previousState: {
          matchStatus: "AI_SUGGESTED",
        },
        newState: {
          matchStatus: "CONFIRMED",
          confirmedBy: session.user.id,
        },
      });
    } catch {
      // Audit darf den Vorgang nicht blockieren
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        amount: Number(updated.amount),
      },
    });
  } catch (error) {
    console.error("Error confirming bank transaction match:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
