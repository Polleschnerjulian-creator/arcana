import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateInvoiceHTML,
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceSettings,
  type OrgData,
} from "@/lib/invoices/pdf";

// ─── GET: Serve Invoice as HTML ─────────────────────────────────
// Returns a self-contained HTML document that can be printed to PDF.

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

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        organization: {
          select: {
            name: true,
            street: true,
            city: true,
            zip: true,
            ustId: true,
            taxId: true,
            settings: true,
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

    const lineItems: InvoiceLineItem[] = JSON.parse(invoice.lineItems);
    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);
    const total = Number(invoice.total);

    // Derive tax rate from amounts
    const taxRate =
      subtotal > 0 ? Math.round((taxAmount / subtotal) * 100) : 0;

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

    // Parse invoice settings from org settings JSON
    let invoiceSettings: InvoiceSettings = {};
    const orgSettings = (invoice.organization as { settings?: string | null }).settings;
    if (orgSettings) {
      try {
        const parsed = JSON.parse(orgSettings);
        invoiceSettings = parsed.invoice || {};
      } catch {
        // Corrupted JSON — use defaults
      }
    }

    const orgData: OrgData = {
      name: invoice.organization.name,
      street: invoice.organization.street || undefined,
      city: invoice.organization.city || undefined,
      zip: invoice.organization.zip || undefined,
      ustId: invoice.organization.ustId || undefined,
      taxId: invoice.organization.taxId || undefined,
      invoiceSettings,
    };

    const html = generateInvoiceHTML(invoiceData, orgData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating invoice HTML:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
