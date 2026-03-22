import { prisma } from "@/lib/db";

// ─── Debitoren Types ─────────────────────────────────────────────

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

// ─── Kreditoren (Vendor Open Items) Types ────────────────────────

export interface KreditorenItem {
  transactionId: string;
  date: Date;
  description: string;
  reference: string | null;
  amount: number; // Credit amount on 1600 = liability
  vendorName: string;
}

export interface KreditorenVendorGroup {
  vendorName: string;
  items: KreditorenItem[];
  subtotal: number;
  itemCount: number;
}

export interface KreditorenOPOSReport {
  asOf: Date;
  vendors: KreditorenVendorGroup[];
  totalItems: number;
  totalOutstanding: number;
}

// ─── Kreditoren Computation ──────────────────────────────────────

/**
 * Berechnet die Kreditoren-OPOS (Verbindlichkeiten aus Lieferungen und Leistungen).
 *
 * Queries BOOKED transactions that have a credit on account 1600 (Verbindlichkeiten aus L+L),
 * which represents incoming invoices that create a vendor liability.
 * Shows all such transactions as open vendor items.
 */
export async function computeKreditorenOPOS(
  organizationId: string
): Promise<KreditorenOPOSReport> {
  const now = new Date();

  // Find account 1600 (Verbindlichkeiten aus L+L) for this org
  const account1600 = await prisma.account.findFirst({
    where: {
      organizationId,
      number: "1600",
    },
    select: { id: true },
  });

  if (!account1600) {
    return {
      asOf: now,
      vendors: [],
      totalItems: 0,
      totalOutstanding: 0,
    };
  }

  // Get all transaction lines on account 1600 with credit (vendor invoice booked)
  const creditLines = await prisma.transactionLine.findMany({
    where: {
      accountId: account1600.id,
      credit: { gt: 0 },
      transaction: {
        organizationId,
        status: "BOOKED",
      },
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: {
      transaction: {
        date: "asc",
      },
    },
  });

  // Get all debit lines on 1600 (payments reducing liabilities)
  const debitLines = await prisma.transactionLine.findMany({
    where: {
      accountId: account1600.id,
      debit: { gt: 0 },
      transaction: {
        organizationId,
        status: "BOOKED",
      },
    },
    select: {
      debit: true,
    },
  });

  // Total credits (liabilities created) vs total debits (liabilities reduced)
  const totalCredits = creditLines.reduce(
    (sum, l) => sum + Number(l.credit),
    0
  );
  const totalDebits = debitLines.reduce(
    (sum, l) => sum + Number(l.debit),
    0
  );

  // If debits >= credits, all liabilities are paid
  if (totalDebits >= totalCredits) {
    return {
      asOf: now,
      vendors: [],
      totalItems: 0,
      totalOutstanding: 0,
    };
  }

  // Build vendor items from credit lines
  const vendorMap = new Map<string, KreditorenItem[]>();

  for (const line of creditLines) {
    const tx = line.transaction;
    // Extract vendor name from transaction description
    // Format is often "Eingangsrechnung – VendorName" or just the description
    const descParts = tx.description.split(" – ");
    const vendorName =
      descParts.length > 1 ? descParts[descParts.length - 1].trim() : tx.description;

    const item: KreditorenItem = {
      transactionId: tx.id,
      date: tx.date,
      description: tx.description,
      reference: tx.reference,
      amount: Number(line.credit),
      vendorName,
    };

    const existing = vendorMap.get(vendorName);
    if (existing) {
      existing.push(item);
    } else {
      vendorMap.set(vendorName, [item]);
    }
  }

  // Build grouped result
  const vendors: KreditorenVendorGroup[] = [];
  let totalItems = 0;
  let totalOutstanding = 0;

  vendorMap.forEach((items, vendorName) => {
    const subtotal = roundCurrency(
      items.reduce((sum, i) => sum + i.amount, 0)
    );

    vendors.push({
      vendorName,
      items,
      subtotal,
      itemCount: items.length,
    });

    totalItems += items.length;
    totalOutstanding += subtotal;
  });

  // Sort vendors alphabetically
  vendors.sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  totalOutstanding = roundCurrency(totalOutstanding);

  return {
    asOf: now,
    vendors,
    totalItems,
    totalOutstanding,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
