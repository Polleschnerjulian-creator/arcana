import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Mark Invoice as SENT ─────────────────────────────────
// Creates a DRAFT transaction with double-entry booking:
//   Debit:  1400 Forderungen aus L+L
//   Credit: 8400 Erlöse 19% USt (or 8300 for 7%)
//   Credit: 1776 Umsatzsteuer 19% (or 1771 for 7%)

// Account mappings per SKR03
const REVENUE_ACCOUNTS: Record<number, string> = {
  19: "8400", // Erlöse 19% USt
  7: "8300",  // Erlöse 7% USt
  0: "8000",  // Erlöse (steuerfrei)
};

const TAX_ACCOUNTS: Record<number, string> = {
  19: "1776", // Umsatzsteuer 19%
  7: "1771",  // Umsatzsteuer 7%
};

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

    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error: `Rechnung kann nicht versendet werden. Aktueller Status: ${invoice.status}.`,
        },
        { status: 400 }
      );
    }

    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);
    const total = Number(invoice.total);

    // Derive tax rate from amounts
    const taxRate =
      subtotal > 0 ? Math.round((taxAmount / subtotal) * 100) : 0;

    // Look up required accounts for this organization
    const revenueAccountNumber = REVENUE_ACCOUNTS[taxRate] || "8000";
    const receivablesAccountNumber = "1400"; // Forderungen aus L+L

    const accountNumbers = [receivablesAccountNumber, revenueAccountNumber];
    if (taxRate > 0 && TAX_ACCOUNTS[taxRate]) {
      accountNumbers.push(TAX_ACCOUNTS[taxRate]);
    }

    const accounts = await prisma.account.findMany({
      where: {
        organizationId: session.user.organizationId,
        number: { in: accountNumbers },
      },
      select: { id: true, number: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

    // Verify all required accounts exist
    const missingAccounts = accountNumbers.filter((n) => !accountMap.has(n));
    if (missingAccounts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Erforderliche Konten nicht gefunden: ${missingAccounts.join(", ")}. Bitte legen Sie diese in Ihrem Kontenrahmen an.`,
        },
        { status: 400 }
      );
    }

    // Create transaction and update invoice in a single DB transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Build transaction lines
      const lines: Array<{
        accountId: string;
        debit: number;
        credit: number;
        taxRate: number | null;
        taxAccountId: string | null;
        note: string | null;
      }> = [];

      // Debit: Receivables (total amount)
      lines.push({
        accountId: accountMap.get(receivablesAccountNumber)!,
        debit: total,
        credit: 0,
        taxRate: null,
        taxAccountId: null,
        note: `Rechnung ${invoice.invoiceNumber}`,
      });

      // Credit: Revenue (net amount)
      lines.push({
        accountId: accountMap.get(revenueAccountNumber)!,
        debit: 0,
        credit: subtotal,
        taxRate: taxRate > 0 ? taxRate : null,
        taxAccountId:
          taxRate > 0 && TAX_ACCOUNTS[taxRate]
            ? accountMap.get(TAX_ACCOUNTS[taxRate]) || null
            : null,
        note: `Erlöse ${invoice.invoiceNumber}`,
      });

      // Credit: Tax (if applicable)
      if (taxRate > 0 && taxAmount > 0) {
        lines.push({
          accountId: accountMap.get(TAX_ACCOUNTS[taxRate])!,
          debit: 0,
          credit: taxAmount,
          taxRate: null,
          taxAccountId: null,
          note: `USt ${taxRate}% ${invoice.invoiceNumber}`,
        });
      }

      // Create the transaction
      const transaction = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: invoice.issueDate,
          description: `Ausgangsrechnung ${invoice.invoiceNumber} – ${invoice.customerName}`,
          reference: invoice.invoiceNumber,
          status: "DRAFT",
          source: "API",
          lines: {
            create: lines,
          },
        },
      });

      // Update invoice status and link transaction
      const updatedInvoice = await tx.invoice.update({
        where: { id: params.id },
        data: {
          status: "SENT",
          transactionId: transaction.id,
        },
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

      return updatedInvoice;
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
          status: "DRAFT",
          transactionId: null,
        },
        newState: {
          status: "SENT",
          transactionId: updated.transactionId,
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
    console.error("Error sending invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
