import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { learnCategorization } from "@/lib/ai/learning";

// ─── POST: Confirm AI-Suggested Match ────────────────────────────

export async function POST(
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

    // Bankbewegung laden
    const bankTransaction = await prisma.bankTransaction.findFirst({
      where: {
        id: id,
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
      where: { id: id },
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
        entityId: id,
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

    // Auto-mark linked invoice as PAID
    if (bankTransaction.matchedTransactionId) {
      try {
        const linkedInvoice = await prisma.invoice.findFirst({
          where: {
            transactionId: bankTransaction.matchedTransactionId,
            status: { in: ["SENT", "OVERDUE"] },
          },
        });

        if (linkedInvoice) {
          await prisma.invoice.update({
            where: { id: linkedInvoice.id },
            data: { status: "PAID" },
          });

          await createAuditEntry({
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "UPDATE",
            entityType: "INVOICE",
            entityId: linkedInvoice.id,
            previousState: { status: linkedInvoice.status },
            newState: { status: "PAID", paidVia: "BANK_MATCH_AUTO" },
          }).catch(() => {});
        }
      } catch {
        // Auto-pay darf den Vorgang nicht blockieren
      }
    }

    // Auto-book the matched transaction if still DRAFT
    if (bankTransaction.matchedTransactionId) {
      try {
        const matchedTx = await prisma.transaction.findUnique({
          where: { id: bankTransaction.matchedTransactionId },
        });

        if (matchedTx && matchedTx.status === "DRAFT") {
          await prisma.transaction.update({
            where: { id: matchedTx.id },
            data: {
              status: "BOOKED",
              bookedAt: new Date(),
              bookedById: session.user.id,
            },
          });

          await createAuditEntry({
            organizationId: session.user.organizationId,
            userId: session.user.id,
            action: "BOOK",
            entityType: "TRANSACTION",
            entityId: matchedTx.id,
            previousState: { status: "DRAFT" },
            newState: { status: "BOOKED", bookedVia: "BANK_MATCH_AUTO" },
          }).catch(() => {});
        }
      } catch {
        // Auto-book darf den Vorgang nicht blockieren
      }
    }

    // Learn from the confirmed match for future auto-categorization
    try {
      if (updated.counterpartName && updated.matchedTransactionId) {
        const lines = await prisma.transactionLine.findMany({
          where: { transactionId: updated.matchedTransactionId },
          include: { account: true },
        });
        const debit = lines.find((l) => Number(l.debit) > 0);
        const credit = lines.find((l) => Number(l.credit) > 0);
        if (debit && credit) {
          await learnCategorization({
            organizationId: session.user.organizationId,
            vendorName: updated.counterpartName,
            debitAccountNumber: debit.account.number,
            creditAccountNumber: credit.account.number,
            taxRate: debit.taxRate ?? undefined,
          });
        }
      }
    } catch {
      // Learning is silent — never block the main flow
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
