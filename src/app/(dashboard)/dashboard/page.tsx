import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowLeftRight,
  Upload,
  Building2,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Receipt,
  Landmark,
  BarChart3,
} from "lucide-react";

// ─── Data Fetching ───────────────────────────────────────────────

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Revenue this month: sum of credits on REVENUE accounts from BOOKED transactions
  const revenueThisMonth = await prisma.transactionLine.aggregate({
    _sum: { credit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      account: { type: "REVENUE" },
    },
  });

  // Revenue last month
  const revenueLastMonth = await prisma.transactionLine.aggregate({
    _sum: { credit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      account: { type: "REVENUE" },
    },
  });

  // Expenses this month: sum of debits on EXPENSE accounts from BOOKED transactions
  const expensesThisMonth = await prisma.transactionLine.aggregate({
    _sum: { debit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      account: { type: "EXPENSE" },
    },
  });

  // Expenses last month
  const expensesLastMonth = await prisma.transactionLine.aggregate({
    _sum: { debit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      account: { type: "EXPENSE" },
    },
  });

  // Open documents (no linked transaction)
  const openDocuments = await prisma.document.count({
    where: {
      organizationId,
      transactions: { none: {} },
    },
  });

  // Unmatched bank transactions
  const unmatchedBankTx = await prisma.bankTransaction.count({
    where: {
      bankAccount: { organizationId },
      matchStatus: "UNMATCHED",
    },
  });

  // Recent transactions (last 5)
  const recentTransactions = await prisma.transaction.findMany({
    where: { organizationId },
    orderBy: { date: "desc" },
    take: 5,
    include: {
      lines: {
        include: {
          account: { select: { number: true, name: true, type: true } },
        },
      },
    },
  });

  // Monthly trend: last 6 months revenue vs expenses
  const monthlyTrend: {
    month: string;
    label: string;
    revenue: number;
    expenses: number;
  }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthLabel = monthStart.toLocaleDateString("de-DE", { month: "short" });

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

    const exp = await prisma.transactionLine.aggregate({
      _sum: { debit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: monthStart, lte: monthEnd },
        },
        account: { type: "EXPENSE" },
      },
    });

    monthlyTrend.push({
      month: monthStart.toISOString(),
      label: monthLabel,
      revenue: Number(rev._sum.credit ?? 0),
      expenses: Number(exp._sum.debit ?? 0),
    });
  }

  return {
    revenue: Number(revenueThisMonth._sum.credit ?? 0),
    revenueLast: Number(revenueLastMonth._sum.credit ?? 0),
    expenses: Number(expensesThisMonth._sum.debit ?? 0),
    expensesLast: Number(expensesLastMonth._sum.debit ?? 0),
    openDocuments,
    unmatchedBankTx,
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      reference: tx.reference,
      status: tx.status as "DRAFT" | "BOOKED" | "CANCELLED",
      totalDebit: tx.lines.reduce((sum, l) => sum + Number(l.debit), 0),
      totalCredit: tx.lines.reduce((sum, l) => sum + Number(l.credit), 0),
      primaryAccount: tx.lines[0]?.account
        ? `${tx.lines[0].account.number} ${tx.lines[0].account.name}`
        : "\u2014",
    })),
    monthlyTrend,
  };
}

// ─── Trend Calculation ───────────────────────────────────────────

function calcTrend(current: number, previous: number): { value: string; positive: boolean } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { value: "+100%", positive: true };
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return {
    value: `${sign}${change.toFixed(1)}%`,
    positive: change >= 0,
  };
}

// ─── Status Styling ──────────────────────────────────────────────

const STATUS_DOT: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "bg-yellow-400" },
  BOOKED: { label: "Gebucht", color: "bg-emerald-400" },
  CANCELLED: { label: "Storniert", color: "bg-red-400" },
};

// ─── Time-based Greeting ─────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morgen";
  if (hour < 18) return "Tag";
  return "Abend";
}

// ─── Page Component ──────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })?.organizationId;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
        </div>
      </div>
    );
  }

  const data = await getDashboardData(organizationId);

  const revenueTrend = calcTrend(data.revenue, data.revenueLast);
  const expensesTrend = calcTrend(data.expenses, data.expensesLast);

  // Find max value for chart scaling
  const chartMax = Math.max(
    ...data.monthlyTrend.flatMap((m) => [m.revenue, m.expenses]),
    1
  );

  const userName = (session?.user as { name?: string })?.name || "Nutzer";
  const firstName = userName.split(" ")[0];
  const greeting = getGreeting();

  const now = new Date();
  const dateStr = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const kpiCards = [
    {
      label: "Einnahmen",
      value: formatCurrency(data.revenue),
      icon: DollarSign,
      trend: revenueTrend,
      trendInverted: false,
      subtitle: "Laufender Monat",
    },
    {
      label: "Ausgaben",
      value: formatCurrency(data.expenses),
      icon: Receipt,
      trend: expensesTrend,
      trendInverted: true,
      subtitle: "Laufender Monat",
    },
    {
      label: "Offene Belege",
      value: data.openDocuments.toString(),
      icon: FileText,
      trend: data.openDocuments > 0 ? { value: "Zu bearbeiten", positive: false } : null,
      trendInverted: false,
      subtitle: "Ohne Buchung",
    },
    {
      label: "Offene Bankposten",
      value: data.unmatchedBankTx.toString(),
      icon: Landmark,
      trend: data.unmatchedBankTx > 0 ? { value: "Abzugleichen", positive: false } : null,
      trendInverted: false,
      subtitle: "Nicht zugeordnet",
    },
  ];

  const quickActions = [
    { label: "Beleg hochladen", icon: Upload, href: "/documents/upload" },
    { label: "Neue Buchung", icon: ArrowLeftRight, href: "/transactions/new" },
    { label: "Bank importieren", icon: Building2, href: "/bank/import" },
    { label: "Berichte", icon: BarChart3, href: "/reports" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="animate-in">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          Guten {greeting}, {firstName}
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          const isPositive = card.trend?.positive ?? true;
          const showTrendArrow =
            card.trend && card.trend.value.includes("%");

          return (
            <div
              key={card.label}
              className={`glass glass-hover rounded-2xl p-5 animate-in delay-${i + 1}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.06] dark:bg-white/[0.08]">
                  <Icon className="h-4.5 w-4.5 text-[var(--color-text)]" />
                </div>
                {card.trend && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      card.trendInverted
                        ? isPositive
                          ? "bg-red-500/10 text-red-500"
                          : "bg-emerald-500/10 text-emerald-500"
                        : isPositive
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {showTrendArrow &&
                      (isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      ))}
                    {!showTrendArrow && <AlertCircle className="h-3 w-3" />}
                    {card.trend.value}
                  </span>
                )}
              </div>
              <div className="text-3xl font-semibold tracking-tight text-text-primary">
                {card.value}
              </div>
              <p className="text-sm text-text-secondary mt-1">{card.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in delay-5`}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <div className="glass glass-hover rounded-2xl p-5 flex flex-col items-center gap-3 text-center cursor-pointer group transition-transform duration-200 hover:scale-[1.02]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black shadow-glow group-hover:shadow-glow-lg transition-shadow duration-200">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-text-primary">{action.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="glass rounded-2xl p-6 animate-in delay-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-text-primary">
              Einnahmen vs. Ausgaben
            </h2>
            <span className="text-xs text-text-secondary">Letzte 6 Monate</span>
          </div>

          {/* Legend as pills */}
          <div className="flex items-center gap-3 mb-5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Einnahmen</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-200/60 dark:bg-gray-600/30 px-2.5 py-1">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ausgaben</span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end gap-3 h-48">
            {data.monthlyTrend.map((month) => {
              const revHeight = chartMax > 0 ? (month.revenue / chartMax) * 100 : 0;
              const expHeight = chartMax > 0 ? (month.expenses / chartMax) * 100 : 0;

              return (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex items-end gap-1 w-full h-40">
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-md bg-emerald-500/80 hover:bg-emerald-500 transition-all duration-200 min-h-[2px]"
                        style={{ height: `${Math.max(revHeight, 1)}%` }}
                        title={`Einnahmen: ${formatCurrency(month.revenue)}`}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-md bg-gray-300/80 dark:bg-gray-600/80 hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-200 min-h-[2px]"
                        style={{ height: `${Math.max(expHeight, 1)}%` }}
                        title={`Ausgaben: ${formatCurrency(month.expenses)}`}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary font-medium">{month.label}</span>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-secondary">Gesamt (6 Mo.)</p>
              <p className="text-sm font-semibold text-emerald-500 font-mono tabular-nums mt-0.5">
                {formatCurrency(data.monthlyTrend.reduce((s, m) => s + m.revenue, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Gesamt (6 Mo.)</p>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 font-mono tabular-nums mt-0.5">
                {formatCurrency(data.monthlyTrend.reduce((s, m) => s + m.expenses, 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass rounded-2xl overflow-hidden animate-in delay-6">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-base font-semibold text-text-primary">Letzte Buchungen</h2>
            <Link
              href="/transactions"
              className="text-xs font-medium text-primary hover:text-primary-dark transition-colors inline-flex items-center gap-1"
            >
              Alle anzeigen
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100/80 dark:bg-white/[0.06] mb-3">
                <ArrowLeftRight className="h-5 w-5 text-text-secondary" />
              </div>
              <p className="text-sm text-text-secondary">Noch keine Buchungen vorhanden</p>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="space-y-0.5">
                {data.recentTransactions.map((tx, i) => {
                  const statusConfig = STATUS_DOT[tx.status] ?? {
                    label: tx.status,
                    color: "bg-gray-400",
                  };
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-4 py-3.5 ${
                        i < data.recentTransactions.length - 1
                          ? "border-b border-black/[0.06] dark:border-white/[0.06]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${statusConfig.color}`}
                          title={statusConfig.label}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {formatDate(tx.date)} &middot; {tx.primaryAccount}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-mono tabular-nums text-text-primary font-medium whitespace-nowrap">
                        {formatCurrency(tx.totalDebit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
