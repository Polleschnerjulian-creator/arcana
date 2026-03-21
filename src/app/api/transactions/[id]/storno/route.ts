import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Stornobuchung (Cancel a BOOKED Transaction) ─────────

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

    const existing = await prisma.transaction.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, number: true, name: true } },
            taxAccount: { select: { id: true, number: true, name: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Buchung nicht gefunden." },
        { status: 404 }
      );
    }

    if (existing.status !== "BOOKED") {
      return NextResponse.json(
        {
          success: false,
          error:
            existing.status === "DRAFT"
              ? "Entwürfe können nicht storniert werden. Löschen Sie den Entwurf stattdessen."
              : "Buchung ist bereits storniert.",
        },
        { status: 400 }
      );
    }

    // Create reversal and cancel original in a Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the reverse transaction (swap debit/credit)
      const reversal = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: new Date(),
          description: `Storno: ${existing.description}`,
          reference: existing.reference
            ? `S-${existing.reference}`
            : null,
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: session.user.id,
          source: "MANUAL",
          lines: {
            create: existing.lines.map((line) => ({
              accountId: line.accountId,
              debit: Number(line.credit), // Swap: original credit becomes debit
              credit: Number(line.debit), // Swap: original debit becomes credit
              taxRate: line.taxRate,
              taxAccountId: line.taxAccountId,
              note: line.note
                ? `Storno: ${line.note}`
                : "Stornobuchung",
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, number: true, name: true } },
              taxAccount: {
                select: { id: true, number: true, name: true },
              },
            },
          },
          bookedBy: { select: { id: true, name: true } },
        },
      });

      // 2. Cancel the original transaction — link to reversal
      const cancelled = await tx.transaction.update({
        where: { id: params.id },
        data: {
          status: "CANCELLED",
          cancelledById: reversal.id,
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, number: true, name: true } },
              taxAccount: {
                select: { id: true, number: true, name: true },
              },
            },
          },
          bookedBy: { select: { id: true, name: true } },
          cancelledBy: {
            select: { id: true, description: true, reference: true },
          },
        },
      });

      return { cancelled, reversal };
    });

    // Audit entries
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CANCEL",
        entityType: "TRANSACTION",
        entityId: params.id,
        previousState: { status: "BOOKED" },
        newState: {
          status: "CANCELLED",
          cancelledById: result.reversal.id,
        },
      });

      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "TRANSACTION",
        entityId: result.reversal.id,
        newState: {
          description: result.reversal.description,
          status: "BOOKED",
          isStorno: true,
          originalTransactionId: params.id,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    // Serialize Decimal fields
    const serializeTx = (tx: typeof result.cancelled | typeof result.reversal) => ({
      ...tx,
      lines: tx.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        cancelled: serializeTx(result.cancelled),
        reversal: serializeTx(result.reversal),
      },
    });
  } catch (error) {
    console.error("Error creating storno:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
