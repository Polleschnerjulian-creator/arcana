import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        : "—",
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

const STATUS_BADGE: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  DRAFT: { label: "Entwurf", variant: "warning" },
  BOOKED: { label: "Gebucht", variant: "success" },
  CANCELLED: { label: "Storniert", variant: "danger" },
};

// ─── Page Component ──────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })?.organizationId;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Finanzuebersicht und aktuelle Kennzahlen
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Einnahmen */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-success" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Einnahmen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums">
              {formatCurrency(data.revenue)}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-text-muted">Laufender Monat</span>
              {revenueTrend && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
                  <TrendingUp className="h-3 w-3" />
                  {revenueTrend.value}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ausgaben */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-danger" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Ausgaben
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums">
              {formatCurrency(data.expenses)}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-text-muted">Laufender Monat</span>
              {expensesTrend && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    expensesTrend.positive ? "text-danger" : "text-success"
                  }`}
                >
                  {expensesTrend.positive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {expensesTrend.value}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offene Belege */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-warning" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Offene Belege
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary">
              {data.openDocuments}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-text-muted">Ohne Buchung</span>
              {data.openDocuments > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-warning">
                  <AlertCircle className="h-3 w-3" />
                  Zu bearbeiten
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offene Bankposten */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-info" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Offene Bankposten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary">
              {data.unmatchedBankTx}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-text-muted">Nicht zugeordnet</span>
              {data.unmatchedBankTx > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-info">
                  <AlertCircle className="h-3 w-3" />
                  Abzugleichen
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Einnahmen vs. Ausgaben</CardTitle>
              <span className="text-xs text-text-muted">Letzte 6 Monate</span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-success" />
                <span className="text-xs text-text-secondary">Einnahmen</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-danger" />
                <span className="text-xs text-text-secondary">Ausgaben</span>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="flex items-end gap-3 h-48">
              {data.monthlyTrend.map((month) => {
                const revHeight = chartMax > 0 ? (month.revenue / chartMax) * 100 : 0;
                const expHeight = chartMax > 0 ? (month.expenses / chartMax) * 100 : 0;

                return (
                  <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                    {/* Bars */}
                    <div className="flex items-end gap-1 w-full h-40">
                      <div className="flex-1 flex flex-col justify-end">
                        <div
                          className="w-full rounded-t bg-success/80 hover:bg-success transition-colors min-h-[2px]"
                          style={{ height: `${Math.max(revHeight, 1)}%` }}
                          title={`Einnahmen: ${formatCurrency(month.revenue)}`}
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-end">
                        <div
                          className="w-full rounded-t bg-danger/80 hover:bg-danger transition-colors min-h-[2px]"
                          style={{ height: `${Math.max(expHeight, 1)}%` }}
                          title={`Ausgaben: ${formatCurrency(month.expenses)}`}
                        />
                      </div>
                    </div>

                    {/* Month label */}
                    <span className="text-xs text-text-muted font-medium">{month.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Summary row under chart */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted">Gesamteinnahmen (6 Mo.)</p>
                <p className="text-sm font-semibold text-success font-mono tabular-nums">
                  {formatCurrency(data.monthlyTrend.reduce((s, m) => s + m.revenue, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Gesamtausgaben (6 Mo.)</p>
                <p className="text-sm font-semibold text-danger font-mono tabular-nums">
                  {formatCurrency(data.monthlyTrend.reduce((s, m) => s + m.expenses, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schnellzugriff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/documents/upload" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary-50 transition-all group cursor-pointer">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Beleg hochladen</p>
                  <p className="text-xs text-text-muted">Rechnung oder Quittung erfassen</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            <Link href="/transactions/new" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary-50 transition-all group cursor-pointer">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Neue Buchung</p>
                  <p className="text-xs text-text-muted">Manuelle Buchung erstellen</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            <Link href="/bank/import" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary-50 transition-all group cursor-pointer">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Bank importieren</p>
                  <p className="text-xs text-text-muted">CSV- oder MT940-Datei laden</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            <Link href="/reports" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary-50 transition-all group cursor-pointer">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Berichte erstellen</p>
                  <p className="text-xs text-text-muted">EUeR, BWA oder DATEV-Export</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Letzte Buchungen</CardTitle>
            <Link href="/transactions">
              <Button variant="ghost" size="sm">
                Alle anzeigen
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
              <ArrowLeftRight className="h-8 w-8 mb-2 text-text-muted" />
              <p className="text-sm">Noch keine Buchungen vorhanden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-t border-border bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Beschreibung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Konto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Betrag
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentTransactions.map((tx) => {
                    const statusConfig = STATUS_BADGE[tx.status] ?? {
                      label: tx.status,
                      variant: "default" as const,
                    };
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-text-primary whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-text-primary max-w-xs truncate">
                          {tx.description}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-text-secondary whitespace-nowrap font-mono">
                          {tx.primaryAccount}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                          {formatCurrency(tx.totalDebit)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
