import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: Search Transactions for Manual Matching ────────────────
//
// Sucht bestehende Buchungen anhand von Beschreibung oder Belegnummer,
// um sie manuell einer Bankbewegung zuzuordnen.

export async function GET(
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

    const orgId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Verify bank transaction belongs to this organization
    const bankTransaction = await prisma.bankTransaction.findFirst({
      where: {
        id: id,
        bankAccount: { organizationId: orgId },
      },
    });

    if (!bankTransaction) {
      return NextResponse.json(
        { success: false, error: "Bankbewegung nicht gefunden." },
        { status: 404 }
      );
    }

    // Search transactions by description or reference
    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["DRAFT", "BOOKED"] },
        OR: [
          { description: { contains: query } },
          { reference: { contains: query } },
        ],
      },
      include: {
        lines: true,
      },
      orderBy: { date: "desc" },
      take: 20,
    });

    const results = transactions.map((tx) => {
      const totalDebit = tx.lines.reduce(
        (sum, l) => sum + Number(l.debit),
        0
      );
      return {
        id: tx.id,
        description: tx.description,
        reference: tx.reference,
        date: tx.date.toISOString(),
        amount: totalDebit,
        status: tx.status,
      };
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Fehler bei der Transaktionssuche:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
