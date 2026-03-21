import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findPotentialMatches } from "@/lib/bank/matching";
import type { OpenItem } from "@/lib/bank/matching";

// ─── GET: Fetch AI Match Suggestions ─────────────────────────────
//
// Ruft offene Buchungen/Rechnungen ab und vergleicht sie mit der
// Bankbewegung, um potenzielle Zuordnungen vorzuschlagen.

export async function GET(
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

    // Offene Buchungen laden (DRAFT + BOOKED, die noch keiner Bankbewegung zugeordnet sind)
    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["DRAFT", "BOOKED"] },
        bankTransactions: { none: {} },
      },
      include: {
        lines: {
          include: {
            account: { select: { number: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    // Offene Posten aufbauen
    const openItems: OpenItem[] = transactions.map((tx) => {
      const totalDebit = tx.lines.reduce(
        (sum, l) => sum + Number(l.debit),
        0
      );
      return {
        id: tx.id,
        type: "transaction" as const,
        amount: totalDebit,
        date: tx.date,
        description: tx.description,
        counterpartName: undefined,
      };
    });

    // Matching-Engine ausführen
    const matches = findPotentialMatches(
      {
        amount: Number(bankTransaction.amount),
        date: bankTransaction.date,
        counterpartName: bankTransaction.counterpartName || undefined,
      },
      openItems
    );

    // Matches mit Transaction-Details anreichern
    const suggestions = matches.slice(0, 10).map((match) => {
      const tx = transactions.find((t) => t.id === match.openItemId);
      const totalDebit = tx
        ? tx.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        : 0;

      return {
        transactionId: match.openItemId,
        description: tx?.description || "",
        reference: tx?.reference || null,
        amount: totalDebit,
        date: tx?.date.toISOString() || "",
        confidence: match.confidence,
      };
    });

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("Fehler beim Laden der Vorschläge:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
