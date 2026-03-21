import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Reject AI-Suggested Match ─────────────────────────────
//
// Lehnt einen KI-Vorschlag ab und setzt die Bankbewegung
// zurück auf UNMATCHED.

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

    const orgId = session.user.organizationId;

    // Bankbewegung laden
    const bankTransaction = await prisma.bankTransaction.findFirst({
      where: {
        id: params.id,
        bankAccount: { organizationId: orgId },
      },
    });

    if (!bankTransaction) {
      return NextResponse.json(
        { success: false, error: "Bankbewegung nicht gefunden." },
        { status: 404 }
      );
    }

    if (bankTransaction.matchStatus !== "AI_SUGGESTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Nur KI-Vorschläge können abgelehnt werden.",
        },
        { status: 400 }
      );
    }

    // Vorschlag ablehnen: Status → UNMATCHED, Match entfernen
    const previousState = {
      matchStatus: bankTransaction.matchStatus,
      matchedTransactionId: bankTransaction.matchedTransactionId,
      matchConfidence: bankTransaction.matchConfidence,
    };

    const updated = await prisma.bankTransaction.update({
      where: { id: params.id },
      data: {
        matchStatus: "UNMATCHED",
        matchedTransactionId: null,
        matchConfidence: null,
      },
    });

    const newState = {
      matchStatus: updated.matchStatus,
      matchedTransactionId: updated.matchedTransactionId,
      matchConfidence: updated.matchConfidence,
    };

    // Audit-Log
    await createAuditEntry({
      organizationId: orgId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "BANK_TRANSACTION",
      entityId: params.id,
      previousState,
      newState,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler beim Ablehnen des Vorschlags:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
