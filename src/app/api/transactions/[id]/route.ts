import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateDoubleEntry } from "@/lib/accounting/ledger";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema for Updates ────────────────────────────────────

const updateTransactionSchema = z.object({
  date: z.string().optional(),
  description: z
    .string()
    .min(1, "Beschreibung ist erforderlich.")
    .max(500)
    .optional(),
  reference: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        debit: z.number().min(0),
        credit: z.number().min(0),
        taxRate: z.number().optional().nullable(),
        taxAccountId: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      })
    )
    .min(2)
    .optional(),
});

// ─── Helper ─────────────────────────────────────────────────────

async function getTransaction(id: string, organizationId: string) {
  return prisma.transaction.findFirst({
    where: { id, organizationId },
    include: {
      lines: {
        include: {
          account: { select: { id: true, number: true, name: true } },
          taxAccount: { select: { id: true, number: true, name: true } },
        },
      },
      bookedBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, description: true, reference: true } },
      stornoOf: { select: { id: true, description: true, reference: true } },
    },
  });
}

// ─── GET: Single Transaction ────────────────────────────────────

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

    const transaction = await getTransaction(
      params.id,
      session.user.organizationId
    );

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Buchung nicht gefunden." },
        { status: 404 }
      );
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

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update DRAFT Transaction ────────────────────────────

export async function PATCH(
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

    const existing = await prisma.transaction.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: { lines: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Buchung nicht gefunden." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nur Entwürfe können bearbeitet werden. Festgeschriebene Buchungen sind unveränderlich (GoBD).",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateTransactionSchema.parse(body);

    // If lines are being updated, validate double-entry
    if (data.lines) {
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

      // Verify all accountIds belong to the user's org
      const accountIds = Array.from(new Set(data.lines.map((l) => l.accountId)));
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
            error: `Ungültige Konto-IDs: ${invalidIds.join(", ")}.`,
          },
          { status: 400 }
        );
      }
    }

    // Build previous state for audit
    const previousState = {
      date: existing.date.toISOString(),
      description: existing.description,
      reference: existing.reference,
      linesCount: existing.lines.length,
    };

    // Update in a Prisma transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Delete old lines if new lines are provided
      if (data.lines) {
        await tx.transactionLine.deleteMany({
          where: { transactionId: params.id },
        });
      }

      const updated = await tx.transaction.update({
        where: { id: params.id },
        data: {
          ...(data.date && { date: new Date(data.date) }),
          ...(data.description && { description: data.description }),
          ...(data.reference !== undefined && {
            reference: data.reference || null,
          }),
          ...(data.lines && {
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
          }),
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, number: true, name: true } },
              taxAccount: { select: { id: true, number: true, name: true } },
            },
          },
          bookedBy: { select: { id: true, name: true } },
        },
      });

      return updated;
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "TRANSACTION",
        entityId: transaction.id,
        previousState,
        newState: {
          date: transaction.date.toISOString(),
          description: transaction.description,
          reference: transaction.reference,
          linesCount: transaction.lines.length,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    const serialized = {
      ...transaction,
      lines: transaction.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    };

    return NextResponse.json({ success: true, data: serialized });
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

    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete DRAFT Transaction ───────────────────────────

export async function DELETE(
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

    const existing = await prisma.transaction.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Buchung nicht gefunden." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nur Entwürfe können gelöscht werden. Festgeschriebene Buchungen müssen storniert werden (GoBD).",
        },
        { status: 403 }
      );
    }

    // Cascade delete will remove lines too
    await prisma.transaction.delete({
      where: { id: params.id },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DELETE",
        entityType: "TRANSACTION",
        entityId: params.id,
        previousState: {
          date: existing.date.toISOString(),
          description: existing.description,
          reference: existing.reference,
          status: existing.status,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
