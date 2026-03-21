import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateDoubleEntry } from "@/lib/accounting/ledger";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const transactionLineSchema = z.object({
  accountId: z.string().min(1, "Konto-ID ist erforderlich."),
  debit: z.number().min(0, "Soll darf nicht negativ sein."),
  credit: z.number().min(0, "Haben darf nicht negativ sein."),
  taxRate: z.number().optional().nullable(),
  taxAccountId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const createTransactionSchema = z.object({
  date: z.string().min(1, "Buchungsdatum ist erforderlich."),
  description: z
    .string()
    .min(1, "Beschreibung ist erforderlich.")
    .max(500, "Beschreibung darf maximal 500 Zeichen lang sein."),
  reference: z.string().optional().nullable(),
  lines: z
    .array(transactionLineSchema)
    .min(2, "Mindestens 2 Buchungszeilen erforderlich."),
});

// ─── GET: List Transactions ─────────────────────────────────────

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
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const account = searchParams.get("account");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    // Date range filter
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) {
        dateFilter.gte = new Date(from);
      }
      if (to) {
        // Include the entire "to" day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.date = dateFilter;
    }

    // Filter by account number (transactions that have a line with this account)
    if (account) {
      where.lines = {
        some: {
          account: {
            number: account,
          },
        },
      };
    }

    // Search in description or reference
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { reference: { contains: search } },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, number: true, name: true },
            },
            taxAccount: {
              select: { id: true, number: true, name: true },
            },
          },
        },
        bookedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    // Convert Decimal fields to numbers
    const serialized = transactions.map((tx) => ({
      ...tx,
      lines: tx.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create Transaction ───────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = createTransactionSchema.parse(body);

    // Validate double-entry
    const validation = validateDoubleEntry(
      data.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        taxRate: l.taxRate,
      }))
    );

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Verify all accountIds belong to the user's organization
    const accountIds = Array.from(
      new Set(data.lines.map((l) => l.accountId))
    );

    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        organizationId: session.user.organizationId,
      },
      select: { id: true },
    });

    const foundIds = new Set(accounts.map((a) => a.id));
    const invalidIds = accountIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Ungültige Konto-IDs: ${invalidIds.join(", ")}. Konten gehören nicht zu Ihrer Organisation.`,
        },
        { status: 400 }
      );
    }

    // Create transaction with lines in a Prisma transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: new Date(data.date),
          description: data.description,
          reference: data.reference || null,
          status: "DRAFT",
          source: "MANUAL",
          lines: {
            create: data.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              taxRate: line.taxRate || null,
              taxAccountId: line.taxAccountId || null,
              note: line.note || null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, number: true, name: true },
              },
              taxAccount: {
                select: { id: true, number: true, name: true },
              },
            },
          },
        },
      });

      return created;
    });

    // Audit entry (non-blocking)
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "TRANSACTION",
        entityId: transaction.id,
        newState: {
          date: transaction.date.toISOString(),
          description: transaction.description,
          reference: transaction.reference,
          status: transaction.status,
          linesCount: transaction.lines.length,
        },
      });
    } catch {
      // Audit module may not be ready — don't break the flow
    }

    // Serialize Decimal fields
    const serialized = {
      ...transaction,
      lines: transaction.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    };

    return NextResponse.json(
      { success: true, data: serialized },
      { status: 201 }
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

    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
