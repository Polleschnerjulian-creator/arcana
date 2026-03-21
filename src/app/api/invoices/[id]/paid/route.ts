import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Mark Invoice as PAID ─────────────────────────────────
// Optionally creates a payment transaction:
//   Debit:  1200 Bank
//   Credit: 1400 Forderungen aus L+L

const paidSchema = z.object({
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD")
    .optional(),
});

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

    const body = await request.json().catch(() => ({}));
    const data = paidSchema.parse(body);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (invoice.status !== "SENT") {
      return NextResponse.json(
        {
          success: false,
          error: `Nur versendete Rechnungen können als bezahlt markiert werden. Aktueller Status: ${invoice.status}.`,
        },
        { status: 400 }
      );
    }

    const total = Number(invoice.total);
    const paymentDate = data.paymentDate
      ? new Date(data.paymentDate)
      : new Date();

    // Look up Bank and Receivables accounts
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: session.user.organizationId,
        number: { in: ["1200", "1400"] },
      },
      select: { id: true, number: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

    const bankAccountId = accountMap.get("1200");
    const receivablesAccountId = accountMap.get("1400");

    if (!bankAccountId || !receivablesAccountId) {
      const missing: string[] = [];
      if (!bankAccountId) missing.push("1200 (Bank)");
      if (!receivablesAccountId) missing.push("1400 (Forderungen)");
      return NextResponse.json(
        {
          success: false,
          error: `Erforderliche Konten nicht gefunden: ${missing.join(", ")}. Bitte legen Sie diese in Ihrem Kontenrahmen an.`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Create payment transaction
      await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: paymentDate,
          description: `Zahlungseingang Rechnung ${invoice.invoiceNumber} – ${invoice.customerName}`,
          reference: invoice.invoiceNumber,
          status: "DRAFT",
          source: "API",
          lines: {
            create: [
              {
                accountId: bankAccountId,
                debit: total,
                credit: 0,
                note: `Zahlungseingang ${invoice.invoiceNumber}`,
              },
              {
                accountId: receivablesAccountId,
                debit: 0,
                credit: total,
                note: `Ausgleich Forderung ${invoice.invoiceNumber}`,
              },
            ],
          },
        },
      });

      // Update invoice status
      return tx.invoice.update({
        where: { id: params.id },
        data: { status: "PAID" },
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
        action: "UPDATE",
        entityType: "INVOICE",
        entityId: updated.id,
        previousState: {
          status: "SENT",
        },
        newState: {
          status: "PAID",
          paymentDate: paymentDate.toISOString(),
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

    console.error("Error marking invoice as paid:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
