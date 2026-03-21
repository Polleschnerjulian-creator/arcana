import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: List Bank Transactions ─────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const bankAccountId = searchParams.get("bankAccountId");
    const status = searchParams.get("status");
    const batch = searchParams.get("batch");

    // Filter aufbauen — immer nach Organisation filtern
    const where: Record<string, unknown> = {
      bankAccount: {
        organizationId: session.user.organizationId,
      },
    };

    if (bankAccountId) {
      where.bankAccountId = bankAccountId;
    }

    if (status) {
      where.matchStatus = status;
    }

    if (batch) {
      where.importBatch = batch;
    }

    const bankTransactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        bankAccount: {
          select: {
            id: true,
            name: true,
            iban: true,
            account: {
              select: { id: true, number: true, name: true },
            },
          },
        },
        matchedTransaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            status: true,
            lines: {
              include: {
                account: {
                  select: { id: true, number: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Decimal-Felder serialisieren
    const serialized = bankTransactions.map((bt) => ({
      ...bt,
      amount: Number(bt.amount),
      matchedTransaction: bt.matchedTransaction
        ? {
            ...bt.matchedTransaction,
            lines: bt.matchedTransaction.lines.map((line) => ({
              ...line,
              debit: Number(line.debit),
              credit: Number(line.credit),
            })),
          }
        : null,
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching bank transactions:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
