import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface OPOSInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  status: string;
  daysOverdue: number;
}

export interface OPOSCustomerGroup {
  customerName: string;
  invoices: OPOSInvoice[];
  subtotal: number;
  overdueSubtotal: number;
  invoiceCount: number;
}

export interface OPOSReport {
  asOf: Date;
  customers: OPOSCustomerGroup[];
  totalInvoices: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
}

// ─── Computation ─────────────────────────────────────────────────

/**
 * Berechnet die Offene-Posten-Liste (OPOS) für die gegebene Organisation.
 *
 * Listet alle offenen Rechnungen (SENT, OVERDUE) gruppiert nach Kunde,
 * mit Berechnung der Tage überfällig und Zwischensummen.
 */
export async function computeOPOS(
  organizationId: string
): Promise<OPOSReport> {
  const now = new Date();

  // Fetch all open invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ["SENT", "OVERDUE"] },
    },
    orderBy: [
      { customerName: "asc" },
      { dueDate: "asc" },
    ],
  });

  // Build customer groups
  const customerMap = new Map<string, OPOSInvoice[]>();

  for (const inv of invoices) {
    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
    );

    const item: OPOSInvoice = {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: Number(inv.total),
      status: inv.status,
      daysOverdue,
    };

    const existing = customerMap.get(inv.customerName);
    if (existing) {
      existing.push(item);
    } else {
      customerMap.set(inv.customerName, [item]);
    }
  }

  // Build grouped result
  const customers: OPOSCustomerGroup[] = [];
  let totalInvoices = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let overdueCount = 0;

  customerMap.forEach((items, customerName) => {
    const subtotal = roundCurrency(
      items.reduce((sum, i) => sum + i.total, 0)
    );
    const overdueItems = items.filter((i) => i.daysOverdue > 0);
    const overdueSubtotal = roundCurrency(
      overdueItems.reduce((sum, i) => sum + i.total, 0)
    );

    customers.push({
      customerName,
      invoices: items,
      subtotal,
      overdueSubtotal,
      invoiceCount: items.length,
    });

    totalInvoices += items.length;
    totalOutstanding += subtotal;
    totalOverdue += overdueSubtotal;
    overdueCount += overdueItems.length;
  });

  totalOutstanding = roundCurrency(totalOutstanding);
  totalOverdue = roundCurrency(totalOverdue);

  return {
    asOf: now,
    customers,
    totalInvoices,
    totalOutstanding,
    totalOverdue,
    overdueCount,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
