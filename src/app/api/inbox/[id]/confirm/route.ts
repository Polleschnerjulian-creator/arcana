import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { learnCategorization } from "@/lib/ai/learning";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Confirm an inbox item ─────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const orgId = session.user.organizationId;
    const userId = session.user.id;
    const body = await request.json();
    const { type, sourceId } = body as { type: string; sourceId: string };

    if (!type || !sourceId) {
      return NextResponse.json(
        { success: false, error: "type und sourceId sind erforderlich." },
        { status: 400 }
      );
    }

    // ─── DOCUMENT: Book the linked DRAFT transaction ──────────
    if (type === "DOCUMENT" || type === "EMAIL_IMPORT") {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: sourceId,
          organizationId: orgId,
          status: "DRAFT",
        },
        include: {
          lines: {
            include: {
              account: { select: { number: true, name: true } },
            },
          },
          document: { select: { aiExtraction: true } },
        },
      });

      if (!transaction) {
        return NextResponse.json(
          { success: false, error: "Buchungsentwurf nicht gefunden." },
          { status: 404 }
        );
      }

      // Book the transaction (Festschreibung)
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: userId,
        },
      });

      // Audit log
      try {
        await createAuditEntry({
          organizationId: orgId,
          userId,
          action: "BOOK",
          entityType: "TRANSACTION",
          entityId: transaction.id,
          newState: {
            source: "INBOX_CONFIRM",
            inboxItemId: id,
          },
        });
      } catch {
        // Non-blocking
      }

      // Learn categorization from this confirmation
      const debitLine = transaction.lines.find((l) => Number(l.debit) > 0);
      const creditLine = transaction.lines.find((l) => Number(l.credit) > 0);

      if (debitLine && creditLine) {
        // Extract vendor name from AI extraction or description
        let vendorName = transaction.description;
        if (transaction.document?.aiExtraction) {
          try {
            const extraction = JSON.parse(transaction.document.aiExtraction);
            if (extraction.vendor) vendorName = extraction.vendor;
          } catch {
            // Use description as fallback
          }
        }

        try {
          await learnCategorization({
            organizationId: orgId,
            vendorName,
            debitAccountNumber: debitLine.account.number,
            creditAccountNumber: creditLine.account.number,
            taxRate: debitLine.taxRate ?? undefined,
          });
        } catch {
          // Learning is non-blocking
        }
      }

      return NextResponse.json({
        success: true,
        data: { transactionId: transaction.id, status: "BOOKED" },
      });
    }

    // ─── BANK_TRANSACTION with AI_SUGGESTED: confirm the match ─
    if (type === "BANK_TRANSACTION") {
      const bankTx = await prisma.bankTransaction.findFirst({
        where: {
          id: sourceId,
          bankAccount: { organizationId: orgId },
        },
        include: {
          matchedTransaction: {
            include: {
              lines: {
                include: {
                  account: { select: { number: true, name: true } },
                },
              },
              document: { select: { aiExtraction: true } },
            },
          },
        },
      });

      if (!bankTx) {
        return NextResponse.json(
          { success: false, error: "Bankumsatz nicht gefunden." },
          { status: 404 }
        );
      }

      if (bankTx.matchStatus === "AI_SUGGESTED" && bankTx.matchedTransaction) {
        // Confirm the AI-suggested match
        await prisma.$transaction([
          prisma.bankTransaction.update({
            where: { id: bankTx.id },
            data: { matchStatus: "CONFIRMED" },
          }),
          // Book the linked transaction if still DRAFT
          ...(bankTx.matchedTransaction.status === "DRAFT"
            ? [
                prisma.transaction.update({
                  where: { id: bankTx.matchedTransaction.id },
                  data: {
                    status: "BOOKED",
                    bookedAt: new Date(),
                    bookedById: userId,
                  },
                }),
              ]
            : []),
        ]);

        // Audit log
        try {
          await createAuditEntry({
            organizationId: orgId,
            userId,
            action: "BOOK",
            entityType: "BANK_TRANSACTION",
            entityId: bankTx.id,
            newState: {
              source: "INBOX_CONFIRM",
              matchedTransactionId: bankTx.matchedTransactionId,
            },
          });
        } catch {
          // Non-blocking
        }

        // Learn from this match
        const tx = bankTx.matchedTransaction;
        const debitLine = tx.lines.find((l) => Number(l.debit) > 0);
        const creditLine = tx.lines.find((l) => Number(l.credit) > 0);

        if (debitLine && creditLine && bankTx.counterpartName) {
          try {
            await learnCategorization({
              organizationId: orgId,
              vendorName: bankTx.counterpartName,
              debitAccountNumber: debitLine.account.number,
              creditAccountNumber: creditLine.account.number,
              taxRate: debitLine.taxRate ?? undefined,
            });
          } catch {
            // Non-blocking
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            bankTransactionId: bankTx.id,
            transactionId: bankTx.matchedTransactionId,
            status: "CONFIRMED",
          },
        });
      }

      // UNMATCHED: nothing to confirm without a match
      return NextResponse.json(
        {
          success: false,
          error: "Kein Zuordnungsvorschlag vorhanden. Bitte manuell buchen.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Unbekannter Typ: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Inbox Confirm] Error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
