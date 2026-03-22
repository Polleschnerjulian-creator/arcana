import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { sendEmail } from "@/lib/email";
import {
  generateInvoiceHTML,
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceSettings,
  type OrgData,
} from "@/lib/invoices/pdf";

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    // Parse optional email from request body
    const body = await request.json().catch(() => ({}));
    const customerEmail: string | undefined = body?.email;

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
        where: { id: id },
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

    // Send invoice via email if customer email is provided
    let emailSent = false;
    let emailError: string | undefined;

    if (customerEmail) {
      try {
        // Build invoice data for HTML generation
        const org = await prisma.organization.findUnique({
          where: { id: session.user.organizationId },
          select: {
            name: true,
            street: true,
            city: true,
            zip: true,
            ustId: true,
            taxId: true,
            settings: true,
          },
        });

        if (org) {
          const lineItems: InvoiceLineItem[] = JSON.parse(invoice.lineItems);
          const invoiceData: InvoiceData = {
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            customerAddress: invoice.customerAddress || undefined,
            issueDate: invoice.issueDate.toISOString(),
            dueDate: invoice.dueDate.toISOString(),
            lineItems,
            subtotal,
            taxRate,
            taxAmount,
            total,
          };

          let invoiceSettings: InvoiceSettings = {};
          if (org.settings) {
            try {
              const parsed = JSON.parse(org.settings);
              invoiceSettings = parsed.invoice || {};
            } catch {
              // Corrupted JSON — use defaults
            }
          }

          const orgData: OrgData = {
            name: org.name,
            street: org.street || undefined,
            city: org.city || undefined,
            zip: org.zip || undefined,
            ustId: org.ustId || undefined,
            taxId: org.taxId || undefined,
            invoiceSettings,
          };

          const htmlContent = generateInvoiceHTML(invoiceData, orgData);
          const result = await sendEmail({
            to: customerEmail,
            subject: `Rechnung ${invoice.invoiceNumber}`,
            html: htmlContent,
          });

          emailSent = result.success;
          emailError = result.error;
        }
      } catch (err) {
        console.error("Error sending invoice email:", err);
        emailError = "E-Mail konnte nicht gesendet werden.";
      }
    }

    const serialized = {
      ...updated,
      subtotal: Number(updated.subtotal),
      taxAmount: Number(updated.taxAmount),
      total: Number(updated.total),
    };

    return NextResponse.json({
      success: true,
      data: serialized,
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error("Error sending invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
