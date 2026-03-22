import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

export interface Insight {
  id: string;
  type: "warning" | "info" | "success" | "action";
  icon: string; // lucide icon name
  title: string;
  description: string;
  actionUrl?: string;
  actionLabel?: string;
}

// ─── Main Insight Generator ─────────────────────────────────────

export async function generateInsights(organizationId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Run all checks in parallel for performance
  const [
    expenseSpike,
    overdueInvoices,
    unprocessedItems,
    taxReminder,
    revenueMilestone,
    cashFlowWarning,
  ] = await Promise.all([
    checkExpenseSpike(organizationId, currentMonthStart, currentMonthEnd, lastMonthStart, lastMonthEnd),
    checkOverdueInvoices(organizationId, now),
    checkUnprocessedItems(organizationId),
    checkTaxReminder(now),
    checkRevenueMilestone(organizationId, currentMonthStart, currentMonthEnd, now),
    checkCashFlowWarning(organizationId, currentMonthStart, currentMonthEnd),
  ]);

  if (expenseSpike) insights.push(expenseSpike);
  if (overdueInvoices) insights.push(overdueInvoices);
  if (unprocessedItems) insights.push(unprocessedItems);
  if (taxReminder) insights.push(taxReminder);
  if (revenueMilestone) insights.push(revenueMilestone);
  if (cashFlowWarning) insights.push(cashFlowWarning);

  return insights;
}

// ─── 1. Expense Spike ───────────────────────────────────────────

async function checkExpenseSpike(
  organizationId: string,
  currentStart: Date,
  currentEnd: Date,
  lastStart: Date,
  lastEnd: Date
): Promise<Insight | null> {
  try {
    // Get expense categories this month grouped by account
    const expensesThisMonth = await prisma.transactionLine.groupBy({
      by: ["accountId"],
      _sum: { debit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: currentStart, lte: currentEnd },
        },
        account: { type: "EXPENSE" },
      },
    });

    if (expensesThisMonth.length === 0) return null;

    // Get expense categories last month
    const expensesLastMonth = await prisma.transactionLine.groupBy({
      by: ["accountId"],
      _sum: { debit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: lastStart, lte: lastEnd },
        },
        account: { type: "EXPENSE" },
      },
    });

    const lastMonthMap = new Map(
      expensesLastMonth.map((e) => [e.accountId, Number(e._sum.debit ?? 0)])
    );

    // Find biggest spike
    let biggestSpike: { accountId: string; current: number; previous: number; pct: number } | null = null;

    for (const expense of expensesThisMonth) {
      const current = Number(expense._sum.debit ?? 0);
      const previous = lastMonthMap.get(expense.accountId) ?? 0;

      if (previous > 0 && current > 0) {
        const pct = ((current - previous) / previous) * 100;
        if (pct > 30 && (!biggestSpike || pct > biggestSpike.pct)) {
          biggestSpike = { accountId: expense.accountId, current, previous, pct };
        }
      }
    }

    if (!biggestSpike) return null;

    // Get account name
    const account = await prisma.account.findUnique({
      where: { id: biggestSpike.accountId },
      select: { name: true },
    });

    return {
      id: "expense-spike",
      type: "warning",
      icon: "TrendingUp",
      title: "Ausgabenanstieg erkannt",
      description: `Ihre Ausgaben für ${account?.name ?? "eine Kategorie"} sind diesen Monat ${Math.round(biggestSpike.pct)}% höher als üblich (${formatCurrency(biggestSpike.current)} vs. Ø ${formatCurrency(biggestSpike.previous)})`,
      actionUrl: "/reports",
      actionLabel: "Bericht ansehen",
    };
  } catch {
    return null;
  }
}

// ─── 2. Overdue Invoices ────────────────────────────────────────

async function checkOverdueInvoices(
  organizationId: string,
  now: Date
): Promise<Insight | null> {
  try {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["SENT", "OVERDUE"] },
        dueDate: { lt: sevenDaysAgo },
      },
      select: { total: true },
    });

    if (overdueInvoices.length === 0) return null;

    const totalAmount = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0
    );

    return {
      id: "overdue-invoices",
      type: "action",
      icon: "Clock",
      title: "Überfällige Rechnungen",
      description: `${overdueInvoices.length} ${overdueInvoices.length === 1 ? "Rechnung" : "Rechnungen"} über insgesamt ${formatCurrency(totalAmount)} ${overdueInvoices.length === 1 ? "ist" : "sind"} seit mehr als 7 Tagen überfällig`,
      actionUrl: "/invoices?status=OVERDUE",
      actionLabel: "Rechnungen prüfen",
    };
  } catch {
    return null;
  }
}

// ─── 3. Unprocessed Items ───────────────────────────────────────

async function checkUnprocessedItems(
  organizationId: string
): Promise<Insight | null> {
  try {
    const openDocuments = await prisma.document.count({
      where: {
        organizationId,
        transactions: { none: {} },
      },
    });

    if (openDocuments <= 5) return null;

    return {
      id: "unprocessed-items",
      type: "action",
      icon: "Inbox",
      title: "Offene Posten im Eingangskorb",
      description: `Sie haben ${openDocuments} offene Posten im Eingangskorb`,
      actionUrl: "/inbox",
      actionLabel: "Eingangskorb öffnen",
    };
  } catch {
    return null;
  }
}

// ─── 4. Tax Reminder ────────────────────────────────────────────

async function checkTaxReminder(now: Date): Promise<Insight | null> {
  try {
    // Check if quarter end is within 14 days
    const quarterEndMonths = [2, 5, 8, 11]; // March, June, September, December

    // Find the next quarter end
    let nextQuarterEnd: Date | null = null;
    for (const month of quarterEndMonths) {
      const endDate = new Date(now.getFullYear(), month + 1, 0); // last day of quarter month
      if (endDate >= now) {
        nextQuarterEnd = endDate;
        break;
      }
    }

    if (!nextQuarterEnd) {
      // Must be in December after the 31st — next quarter end is March next year
      nextQuarterEnd = new Date(now.getFullYear() + 1, 3, 0);
    }

    const daysUntil = Math.ceil(
      (nextQuarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil > 14 || daysUntil < 0) return null;

    return {
      id: "tax-reminder",
      type: "info",
      icon: "Calendar",
      title: "Quartalsende naht",
      description: `Quartalsende in ${daysUntil} Tagen — denken Sie an die UStVA`,
      actionUrl: "/reports",
      actionLabel: "Berichte ansehen",
    };
  } catch {
    return null;
  }
}

// ─── 5. Revenue Milestone ───────────────────────────────────────

async function checkRevenueMilestone(
  organizationId: string,
  currentStart: Date,
  currentEnd: Date,
  now: Date
): Promise<Insight | null> {
  try {
    // Revenue this month
    const revenueThisMonth = await prisma.transactionLine.aggregate({
      _sum: { credit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: currentStart, lte: currentEnd },
        },
        account: { type: "REVENUE" },
      },
    });

    const currentRevenue = Number(revenueThisMonth._sum.credit ?? 0);
    if (currentRevenue === 0) return null;

    // Get max monthly revenue from the past 12 months (excluding current)
    // Get all past monthly revenues
    const pastMonths = Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - 11 + i, 0, 23, 59, 59);
      return { monthStart, monthEnd };
    });

    const pastRevenues = await Promise.all(
      pastMonths.map(async ({ monthStart, monthEnd }) => {
        const rev = await prisma.transactionLine.aggregate({
          _sum: { credit: true },
          where: {
            transaction: {
              organizationId,
              status: "BOOKED",
              date: { gte: monthStart, lte: monthEnd },
            },
            account: { type: "REVENUE" },
          },
        });
        return Number(rev._sum.credit ?? 0);
      })
    );

    const previousMax = Math.max(...pastRevenues, 0);

    if (previousMax === 0 || currentRevenue <= previousMax) return null;

    const pctIncrease = Math.round(
      ((currentRevenue - previousMax) / previousMax) * 100
    );

    return {
      id: "revenue-milestone",
      type: "success",
      icon: "Trophy",
      title: "Neuer Umsatzrekord!",
      description: `${formatCurrency(currentRevenue)} Umsatz diesen Monat — ${pctIncrease}% mehr als Ihr bisheriges Maximum`,
      actionUrl: "/reports",
      actionLabel: "Details ansehen",
    };
  } catch {
    return null;
  }
}

// ─── 6. Cash Flow Warning ───────────────────────────────────────

async function checkCashFlowWarning(
  organizationId: string,
  currentStart: Date,
  currentEnd: Date
): Promise<Insight | null> {
  try {
    const [revAgg, expAgg] = await Promise.all([
      prisma.transactionLine.aggregate({
        _sum: { credit: true },
        where: {
          transaction: {
            organizationId,
            status: "BOOKED",
            date: { gte: currentStart, lte: currentEnd },
          },
          account: { type: "REVENUE" },
        },
      }),
      prisma.transactionLine.aggregate({
        _sum: { debit: true },
        where: {
          transaction: {
            organizationId,
            status: "BOOKED",
            date: { gte: currentStart, lte: currentEnd },
          },
          account: { type: "EXPENSE" },
        },
      }),
    ]);

    const revenue = Number(revAgg._sum.credit ?? 0);
    const expenses = Number(expAgg._sum.debit ?? 0);

    // Only warn if both have some activity and expenses exceed revenue
    if (revenue === 0 && expenses === 0) return null;
    if (expenses <= revenue) return null;

    return {
      id: "cash-flow-warning",
      type: "warning",
      icon: "AlertTriangle",
      title: "Cashflow-Warnung",
      description: `Achtung: Ihre Ausgaben (${formatCurrency(expenses)}) übersteigen die Einnahmen (${formatCurrency(revenue)}) diesen Monat`,
      actionUrl: "/reports",
      actionLabel: "BWA ansehen",
    };
  } catch {
    return null;
  }
}
