import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateDoubleEntry } from "@/lib/accounting/ledger";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { validateOrigin } from "@/lib/csrf";

// ─── POST: Festschreibung (Book a DRAFT Transaction) ────────────

export async function POST(
  request: NextRequest,
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

    if (!validateOrigin(request)) {
      return NextResponse.json(
        { success: false, error: "Ungültige Anfrage." },
        { status: 403 }
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

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            existing.status === "BOOKED"
              ? "Buchung ist bereits festgeschrieben."
              : "Stornierte Buchungen können nicht festgeschrieben werden.",
        },
        { status: 400 }
      );
    }

    // Validate double-entry one more time before booking
    const validation = validateDoubleEntry(
      existing.lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit),
        credit: Number(line.credit),
        taxRate: line.taxRate,
      }))
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Festschreibung fehlgeschlagen: ${validation.error}`,
        },
        { status: 400 }
      );
    }

    // Book the transaction
    const booked = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        status: "BOOKED",
        bookedAt: new Date(),
        bookedById: session.user.id,
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

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "BOOK",
        entityType: "TRANSACTION",
        entityId: booked.id,
        previousState: { status: "DRAFT" },
        newState: {
          status: "BOOKED",
          bookedAt: booked.bookedAt?.toISOString(),
          bookedById: session.user.id,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    // Serialize Decimal fields
    const serialized = {
      ...booked,
      lines: booked.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    };

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error booking transaction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
