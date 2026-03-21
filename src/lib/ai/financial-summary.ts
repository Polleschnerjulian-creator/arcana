import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface FinancialSummary {
  organization: {
    name: string;
    chartOfAccounts: string;
    accountingMethod: string;
    legalForm: string;
  };
  currentMonth: {
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  };
  currentYear: {
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  };
  topExpenseCategories: {
    accountNumber: string;
    accountName: string;
    total: number;
  }[];
  invoices: {
    openCount: number;
    openTotal: number;
    overdueCount: number;
    overdueTotal: number;
    recentInvoices: {
      invoiceNumber: string;
      customerName: string;
      total: number;
      status: string;
      issueDate: string;
      dueDate: string;
    }[];
  };
  bankTransactions: {
    unmatchedCount: number;
  };
  transactions: {
    draftCount: number;
    recentTransactions: {
      date: string;
      description: string;
      amount: number;
      status: string;
    }[];
  };
  tax: {
    ustCurrentQuarter: number;
    vstCurrentQuarter: number;
    zahllast: number;
    quarterLabel: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function getMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(now);
  return { start, end, label };
}

function getYearRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end, label: String(now.getFullYear()) };
}

function getQuarterRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
  return { start, end, label: `Q${quarter + 1} ${now.getFullYear()}` };
}

// ─── Revenue/Expense Aggregation ─────────────────────────────────

async function getRevenueAndExpenses(
  orgId: string,
  dateRange: { start: Date; end: Date }
): Promise<{ revenue: number; expenses: number }> {
  // Revenue = sum of credit on REVENUE accounts in BOOKED transactions
  // Expenses = sum of debit on EXPENSE accounts in BOOKED transactions
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: {
        organizationId: orgId,
        status: "BOOKED",
        date: { gte: dateRange.start, lte: dateRange.end },
      },
    },
    include: {
      account: { select: { type: true } },
    },
  });

  let revenue = 0;
  let expenses = 0;

  for (const line of lines) {
    if (line.account.type === "REVENUE") {
      revenue += Number(line.credit) - Number(line.debit);
    } else if (line.account.type === "EXPENSE") {
      expenses += Number(line.debit) - Number(line.credit);
    }
  }

  return {
    revenue: Math.round(revenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
  };
}

// ─── Main Function ───────────────────────────────────────────────

/**
 * Aggregates financial data for the given organization to provide
 * context to the AI chat assistant. All queries run in parallel
 * where possible to minimize latency.
 */
export async function getFinancialSummary(
  organizationId: string
): Promise<FinancialSummary> {
  const monthRange = getMonthRange();
  const yearRange = getYearRange();
  const quarterRange = getQuarterRange();

  // Run all queries in parallel
  const [
    org,
    monthData,
    yearData,
    topExpenseLines,
    openInvoices,
    overdueInvoices,
    recentInvoices,
    unmatchedBankTx,
    draftTxCount,
    recentTransactions,
    taxPeriods,
  ] = await Promise.all([
    // Organization info
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        chartOfAccounts: true,
        accountingMethod: true,
        legalForm: true,
      },
    }),

    // Current month revenue/expenses
    getRevenueAndExpenses(organizationId, monthRange),

    // Current year revenue/expenses
    getRevenueAndExpenses(organizationId, yearRange),

    // Top expense categories (from BOOKED transactions in current year)
    prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: yearRange.start, lte: yearRange.end },
        },
        account: { type: "EXPENSE" },
      },
      include: {
        account: { select: { number: true, name: true } },
      },
    }),

    // Open invoices (SENT)
    prisma.invoice.aggregate({
      where: { organizationId, status: "SENT" },
      _count: true,
      _sum: { total: true },
    }),

    // Overdue invoices
    prisma.invoice.aggregate({
      where: { organizationId, status: "OVERDUE" },
      _count: true,
      _sum: { total: true },
    }),

    // Last 5 invoices
    prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { issueDate: "desc" },
      take: 5,
      select: {
        invoiceNumber: true,
        customerName: true,
        total: true,
        status: true,
        issueDate: true,
        dueDate: true,
      },
    }),

    // Unmatched bank transactions
    prisma.bankTransaction.count({
      where: {
        matchStatus: "UNMATCHED",
        bankAccount: { organizationId },
      },
    }),

    // Draft transactions count
    prisma.transaction.count({
      where: { organizationId, status: "DRAFT" },
    }),

    // Last 10 transactions
    prisma.transaction.findMany({
      where: { organizationId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        lines: {
          include: {
            account: { select: { type: true } },
          },
        },
      },
    }),

    // Tax periods for current quarter
    prisma.taxPeriod.findMany({
      where: {
        organizationId,
        periodStart: { gte: quarterRange.start },
        periodEnd: { lte: quarterRange.end },
      },
    }),
  ]);

  // Aggregate top expense categories
  const categoryMap = new Map<string, { accountNumber: string; accountName: string; total: number }>();
  for (const line of topExpenseLines) {
    const key = line.account.number;
    const existing = categoryMap.get(key);
    const amount = Number(line.debit) - Number(line.credit);
    if (existing) {
      existing.total += amount;
    } else {
      categoryMap.set(key, {
        accountNumber: line.account.number,
        accountName: line.account.name,
        total: amount,
      });
    }
  }
  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }));

  // Calculate transaction amounts for recent list
  const formattedTransactions = recentTransactions.map((tx) => {
    let amount = 0;
    for (const line of tx.lines) {
      if (line.account.type === "EXPENSE") {
        amount -= Number(line.debit) - Number(line.credit);
      } else if (line.account.type === "REVENUE") {
        amount += Number(line.credit) - Number(line.debit);
      } else {
        // For asset/liability lines, use debit as positive
        amount += Number(line.debit) - Number(line.credit);
      }
    }
    return {
      date: tx.date.toISOString().split("T")[0],
      description: tx.description,
      amount: Math.round(amount * 100) / 100,
      status: tx.status,
    };
  });

  // Tax summary
  let ustTotal = 0;
  let vstTotal = 0;
  for (const period of taxPeriods) {
    ustTotal += Number(period.ustAmount);
    vstTotal += Number(period.vstAmount);
  }
  const zahllast = Math.round((ustTotal - vstTotal) * 100) / 100;

  return {
    organization: {
      name: org.name,
      chartOfAccounts: org.chartOfAccounts,
      accountingMethod: org.accountingMethod,
      legalForm: org.legalForm,
    },
    currentMonth: {
      label: monthRange.label,
      revenue: monthData.revenue,
      expenses: monthData.expenses,
      profit: Math.round((monthData.revenue - monthData.expenses) * 100) / 100,
    },
    currentYear: {
      label: yearRange.label,
      revenue: yearData.revenue,
      expenses: yearData.expenses,
      profit: Math.round((yearData.revenue - yearData.expenses) * 100) / 100,
    },
    topExpenseCategories: topCategories,
    invoices: {
      openCount: openInvoices._count,
      openTotal: Number(openInvoices._sum.total ?? 0),
      overdueCount: overdueInvoices._count,
      overdueTotal: Number(overdueInvoices._sum.total ?? 0),
      recentInvoices: recentInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        total: Number(inv.total),
        status: inv.status,
        issueDate: inv.issueDate.toISOString().split("T")[0],
        dueDate: inv.dueDate.toISOString().split("T")[0],
      })),
    },
    bankTransactions: {
      unmatchedCount: unmatchedBankTx,
    },
    transactions: {
      draftCount: draftTxCount,
      recentTransactions: formattedTransactions,
    },
    tax: {
      ustCurrentQuarter: Math.round(ustTotal * 100) / 100,
      vstCurrentQuarter: Math.round(vstTotal * 100) / 100,
      zahllast,
      quarterLabel: quarterRange.label,
    },
  };
}
