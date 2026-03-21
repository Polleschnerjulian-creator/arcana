import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { findPotentialMatches } from "@/lib/bank/matching";
import type { OpenItem } from "@/lib/bank/matching";

// ─── Zod Schema ──────────────────────────────────────────────────

const matchSchema = z.union([
  z.object({
    transactionId: z.string().min(1, "Transaktions-ID ist erforderlich."),
    auto: z.undefined(),
  }),
  z.object({
    auto: z.literal(true),
    transactionId: z.undefined(),
  }),
]);

// ─── POST: Match a Bank Transaction ──────────────────────────────

export async function POST(
  request: Request,
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

    const body = await request.json();
    const data = matchSchema.parse(body);

    // Bankbewegung laden und prüfen
    const bankTransaction = await prisma.bankTransaction.findFirst({
      where: {
        id: params.id,
        bankAccount: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        bankAccount: true,
      },
    });

    if (!bankTransaction) {
      return NextResponse.json(
        { success: false, error: "Bankbewegung nicht gefunden." },
        { status: 404 }
      );
    }

    if (
      bankTransaction.matchStatus === "CONFIRMED" ||
      bankTransaction.matchStatus === "MANUAL"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Bankbewegung ist bereits zugeordnet.",
        },
        { status: 400 }
      );
    }

    // ─── Manuelles Matching ──────────────────────────────────
    if (data.transactionId) {
      // Prüfen, ob die Ziel-Transaktion existiert und zur Organisation gehört
      const targetTransaction = await prisma.transaction.findFirst({
        where: {
          id: data.transactionId,
          organizationId: session.user.organizationId,
        },
      });

      if (!targetTransaction) {
        return NextResponse.json(
          {
            success: false,
            error: "Ziel-Transaktion nicht gefunden.",
          },
          { status: 404 }
        );
      }

      // Zuordnung speichern
      const updated = await prisma.bankTransaction.update({
        where: { id: params.id },
        data: {
          matchedTransactionId: data.transactionId,
          matchConfidence: 1.0,
          matchStatus: "MANUAL",
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
            matchStatus: bankTransaction.matchStatus,
            matchedTransactionId: bankTransaction.matchedTransactionId,
          },
          newState: {
            matchStatus: "MANUAL",
            matchedTransactionId: data.transactionId,
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
    }

    // ─── Automatisches Matching ──────────────────────────────
    if (data.auto) {
      // Offene Posten laden: Transaktionen im DRAFT/BOOKED-Status,
      // die noch keiner Bankbewegung zugeordnet sind
      const orgTransactions = await prisma.transaction.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: { in: ["DRAFT", "BOOKED"] },
          bankTransactions: {
            none: {},
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { number: true, name: true } },
            },
          },
        },
      });

      // Offene Rechnungen laden
      const orgInvoices = await prisma.invoice.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: { in: ["SENT", "OVERDUE"] },
        },
      });

      // OpenItems zusammenstellen
      const openItems: OpenItem[] = [
        ...orgTransactions.map((tx) => ({
          id: tx.id,
          type: "transaction" as const,
          amount: tx.lines.reduce(
            (sum, l) => sum + Number(l.debit) - Number(l.credit),
            0
          ),
          date: tx.date,
          description: tx.description,
          counterpartName: undefined,
        })),
        ...orgInvoices.map((inv) => ({
          id: inv.id,
          type: "invoice" as const,
          amount: Number(inv.total),
          date: inv.issueDate,
          description: `Rechnung ${inv.invoiceNumber}`,
          counterpartName: inv.customerName,
        })),
      ];

      // Matching durchführen
      const matches = findPotentialMatches(
        {
          amount: Number(bankTransaction.amount),
          date: bankTransaction.date,
          counterpartName: bankTransaction.counterpartName || undefined,
        },
        openItems
      );

      if (matches.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            message: "Keine passenden offenen Posten gefunden.",
            matches: [],
          },
        });
      }

      const bestMatch = matches[0];

      // Wenn der beste Match eine Transaktion ist, zuordnen
      if (bestMatch.openItemType === "transaction") {
        const updated = await prisma.bankTransaction.update({
          where: { id: params.id },
          data: {
            matchedTransactionId: bestMatch.openItemId,
            matchConfidence: bestMatch.confidence,
            matchStatus: "AI_SUGGESTED",
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
              matchStatus: bankTransaction.matchStatus,
            },
            newState: {
              matchStatus: "AI_SUGGESTED",
              matchedTransactionId: bestMatch.openItemId,
              matchConfidence: bestMatch.confidence,
              reasons: bestMatch.reasons,
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
            allMatches: matches,
          },
        });
      }

      // Für Rechnungs-Matches: nur vorschlagen, nicht automatisch verknüpfen
      return NextResponse.json({
        success: true,
        data: {
          message: "Potenzielle Übereinstimmungen gefunden.",
          matches,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Ungültige Anfrage." },
      { status: 400 }
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

    console.error("Error matching bank transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
