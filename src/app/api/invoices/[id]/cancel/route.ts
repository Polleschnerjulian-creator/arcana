import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Cancel Invoice ───────────────────────────────────────
// Only DRAFT or SENT invoices can be cancelled.
// If SENT: also cancels (storno) the linked transaction.

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

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
      include: {
        transaction: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
      return NextResponse.json(
        {
          success: false,
          error: `Rechnung kann nicht storniert werden. Aktueller Status: ${invoice.status}. Nur Entwürfe und versendete Rechnungen können storniert werden.`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If SENT and has a linked transaction, create a storno transaction
      if (invoice.status === "SENT" && invoice.transaction) {
        const originalTx = invoice.transaction;

        // Create reversal (storno) transaction — swap debits and credits
        const stornoTx = await tx.transaction.create({
          data: {
            organizationId: session.user.organizationId,
            date: new Date(),
            description: `Storno: ${originalTx.description}`,
            reference: `STORNO-${invoice.invoiceNumber}`,
            status: "DRAFT",
            source: "API",
            lines: {
              create: originalTx.lines.map((line) => ({
                accountId: line.accountId,
                debit: Number(line.credit),   // Swap: original credit becomes debit
                credit: Number(line.debit),   // Swap: original debit becomes credit
                taxRate: line.taxRate,
                taxAccountId: line.taxAccountId,
                note: `Storno: ${line.note || ""}`.trim(),
              })),
            },
          },
        });

        // Mark original transaction as cancelled, linking to storno
        await tx.transaction.update({
          where: { id: originalTx.id },
          data: {
            status: "CANCELLED",
            cancelledById: stornoTx.id,
          },
        });
      }

      // Update invoice status
      return tx.invoice.update({
        where: { id: id },
        data: { status: "CANCELLED" },
        include: {
          transaction: {
            select: {
              id: true,
              status: true,
              description: true,
              date: true,
            },
          },
        },
      });
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CANCEL",
        entityType: "INVOICE",
        entityId: updated.id,
        previousState: {
          status: invoice.status,
          transactionId: invoice.transactionId,
        },
        newState: {
          status: "CANCELLED",
          invoiceNumber: updated.invoiceNumber,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    const serialized = {
      ...updated,
      subtotal: Number(updated.subtotal),
      taxAmount: Number(updated.taxAmount),
      total: Number(updated.total),
    };

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error cancelling invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
