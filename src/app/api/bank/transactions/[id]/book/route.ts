import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Create Booking from Bank Transaction ──────────────────
//
// Erstellt eine neue DRAFT-Buchung aus einer ungematchten Bankbewegung.
// Verwendet das verknüpfte Konto des Bankkontos (z.B. 1200 Bank) als eine Seite.
// Die Gegenseite wird anhand des Betrags kategorisiert:
//   - Ausgabe → 4900 Sonstige Aufwendungen (Soll)
//   - Einnahme → 8400 Erlöse 19% (Haben)

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
      include: {
        bankAccount: {
          include: {
            account: {
              select: { id: true, number: true, name: true },
            },
          },
        },
      },
    });

    if (!bankTransaction) {
      return NextResponse.json(
        { success: false, error: "Bankbewegung nicht gefunden." },
        { status: 404 }
      );
    }

    // Bereits zugeordnete Bankbewegungen können nicht erneut gebucht werden
    if (bankTransaction.matchedTransactionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Bankbewegung ist bereits einer Buchung zugeordnet.",
        },
        { status: 400 }
      );
    }

    const amount = Math.abs(Number(bankTransaction.amount));
    const isExpense = Number(bankTransaction.amount) < 0;
    const bankAccountKonto = bankTransaction.bankAccount.account;

    // Gegenkonto bestimmen
    // Ausgabe (negativ): 4900 Sonstige Aufwendungen
    // Einnahme (positiv): 8400 Erlöse 19%
    const counterAccountNumber = isExpense ? "4900" : "8400";

    const counterAccount = await prisma.account.findFirst({
      where: {
        organizationId: session.user.organizationId,
        number: counterAccountNumber,
      },
    });

    if (!counterAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Gegenkonto ${counterAccountNumber} nicht gefunden. Bitte stellen Sie sicher, dass der Kontenrahmen angelegt ist.`,
        },
        { status: 400 }
      );
    }

    // Buchungszeilen erstellen (doppelte Buchführung)
    // Ausgabe: Soll 4900, Haben 1200 (Bank)
    // Einnahme: Soll 1200 (Bank), Haben 8400
    const lines = isExpense
      ? [
          {
            accountId: counterAccount.id,
            debit: amount,
            credit: 0,
            taxRate: null as number | null,
            taxAccountId: null as string | null,
            note: null as string | null,
          },
          {
            accountId: bankAccountKonto.id,
            debit: 0,
            credit: amount,
            taxRate: null as number | null,
            taxAccountId: null as string | null,
            note: null as string | null,
          },
        ]
      : [
          {
            accountId: bankAccountKonto.id,
            debit: amount,
            credit: 0,
            taxRate: null as number | null,
            taxAccountId: null as string | null,
            note: null as string | null,
          },
          {
            accountId: counterAccount.id,
            debit: 0,
            credit: amount,
            taxRate: null as number | null,
            taxAccountId: null as string | null,
            note: null as string | null,
          },
        ];

    // Buchungstext zusammenstellen
    const description = [
      bankTransaction.counterpartName,
      bankTransaction.description,
    ]
      .filter(Boolean)
      .join(" — ");

    // Transaktion erstellen und Bankbewegung verknüpfen
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: bankTransaction.date,
          description: description || "Bankbewegung",
          status: "DRAFT",
          source: "BANK_IMPORT",
          lines: {
            create: lines,
          },
        },
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, number: true, name: true },
              },
            },
          },
        },
      });

      // Bankbewegung zuordnen
      const updatedBankTx = await tx.bankTransaction.update({
        where: { id: params.id },
        data: {
          matchedTransactionId: transaction.id,
          matchConfidence: 1.0,
          matchStatus: "MANUAL",
        },
      });

      return { transaction, updatedBankTx };
    });

    // Audit-Eintrag für die neue Transaktion
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "TRANSACTION",
        entityId: result.transaction.id,
        newState: {
          date: result.transaction.date.toISOString(),
          description: result.transaction.description,
          source: "BANK_IMPORT",
          bankTransactionId: params.id,
          linesCount: result.transaction.lines.length,
        },
      });
    } catch {
      // Audit darf den Vorgang nicht blockieren
    }

    // Audit-Eintrag für die Bankbewegung
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "BANK_TRANSACTION",
        entityId: params.id,
        previousState: {
          matchStatus: "UNMATCHED",
          matchedTransactionId: null,
        },
        newState: {
          matchStatus: "MANUAL",
          matchedTransactionId: result.transaction.id,
        },
      });
    } catch {
      // Audit darf den Vorgang nicht blockieren
    }

    // Decimal-Felder serialisieren
    const serialized = {
      ...result.transaction,
      lines: result.transaction.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
      bankTransaction: {
        ...result.updatedBankTx,
        amount: Number(result.updatedBankTx.amount),
      },
    };

    return NextResponse.json(
      { success: true, data: serialized },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error booking bank transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
