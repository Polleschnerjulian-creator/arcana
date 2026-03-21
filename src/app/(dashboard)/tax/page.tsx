import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Receipt,
  ArrowDownLeft,
  Calculator,
  FileText,
  Info,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface QuarterData {
  label: string;
  ust: number;
  vst: number;
  zahllast: number;
}

// ─── USt / VSt Account Numbers ──────────────────────────────────

const UST_ACCOUNTS: Record<string, string[]> = {
  SKR03: ["1776", "1771"],
  SKR04: ["3806", "3801"],
};

const VST_ACCOUNTS: Record<string, string[]> = {
  SKR03: ["1576", "1571"],
  SKR04: ["1406", "1401"],
};

// ─── Data Fetching ──────────────────────────────────────────────

async function getTaxData(organizationId: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

  // Get organization to know chart of accounts
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { chartOfAccounts: true },
  });

  const chart = org?.chartOfAccounts ?? "SKR03";
  const ustAccountNumbers = UST_ACCOUNTS[chart] ?? UST_ACCOUNTS.SKR03;
  const vstAccountNumbers = VST_ACCOUNTS[chart] ?? VST_ACCOUNTS.SKR03;

  // Sum USt: credits on USt accounts from BOOKED transactions
  const ustResult = await prisma.transactionLine.aggregate({
    _sum: { credit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: yearStart, lte: yearEnd },
      },
      account: {
        organizationId,
        number: { in: ustAccountNumbers },
      },
    },
  });

  // Sum VSt: debits on VSt accounts from BOOKED transactions
  const vstResult = await prisma.transactionLine.aggregate({
    _sum: { debit: true },
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: yearStart, lte: yearEnd },
      },
      account: {
        organizationId,
        number: { in: vstAccountNumbers },
      },
    },
  });

  const totalUst = Number(ustResult._sum.credit ?? 0);
  const totalVst = Number(vstResult._sum.debit ?? 0);
  const totalZahllast = totalUst - totalVst;

  // Quarterly breakdown
  const quarters: QuarterData[] = [];
  for (let q = 0; q < 4; q++) {
    const qStart = new Date(currentYear, q * 3, 1);
    const qEnd = new Date(currentYear, q * 3 + 3, 0, 23, 59, 59);

    const qUst = await prisma.transactionLine.aggregate({
      _sum: { credit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: qStart, lte: qEnd },
        },
        account: {
          organizationId,
          number: { in: ustAccountNumbers },
        },
      },
    });

    const qVst = await prisma.transactionLine.aggregate({
      _sum: { debit: true },
      where: {
        transaction: {
          organizationId,
          status: "BOOKED",
          date: { gte: qStart, lte: qEnd },
        },
        account: {
          organizationId,
          number: { in: vstAccountNumbers },
        },
      },
    });

    const ust = Number(qUst._sum.credit ?? 0);
    const vst = Number(qVst._sum.debit ?? 0);

    quarters.push({
      label: `Q${q + 1}`,
      ust,
      vst,
      zahllast: ust - vst,
    });
  }

  // TaxPeriod records (UStVA)
  const taxPeriods = await prisma.taxPeriod.findMany({
    where: {
      organizationId,
      periodStart: { gte: yearStart },
      periodEnd: { lte: yearEnd },
    },
    orderBy: { periodStart: "asc" },
  });

  return {
    currentYear,
    totalUst,
    totalVst,
    totalZahllast,
    quarters,
    taxPeriods: taxPeriods.map((tp) => ({
      id: tp.id,
      type: tp.type,
      periodStart: tp.periodStart.toISOString(),
      periodEnd: tp.periodEnd.toISOString(),
      ustAmount: Number(tp.ustAmount),
      vstAmount: Number(tp.vstAmount),
      payloadAmount: Number(tp.payloadAmount),
      status: tp.status as "OPEN" | "CALCULATED" | "FILED",
      filedAt: tp.filedAt?.toISOString() ?? null,
      createdAt: tp.createdAt.toISOString(),
    })),
  };
}

// ─── Status Config ──────────────────────────────────────────────

const PERIOD_STATUS: Record<
  string,
  { label: string; variant: "default" | "warning" | "success" | "info" }
> = {
  OPEN: { label: "Offen", variant: "warning" },
  CALCULATED: { label: "Berechnet", variant: "info" },
  FILED: { label: "Abgegeben", variant: "success" },
};

const PERIOD_TYPE_LABELS: Record<string, string> = {
  USTVA_MONTHLY: "UStVA Monatlich",
  USTVA_QUARTERLY: "UStVA Quartalsweise",
  ANNUAL: "Jahreserklärung",
};

// ─── Page Component ─────────────────────────────────────────────

export default async function TaxPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })
    ?.organizationId;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
      </div>
    );
  }

  const data = await getTaxData(organizationId);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Steueruebersicht
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Umsatzsteuer, Vorsteuer und Zahllast fuer {data.currentYear}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Umsatzsteuer */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-danger" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-text-secondary">
                Umsatzsteuer (USt)
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-light">
                <Receipt className="h-4 w-4 text-danger" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums">
              {formatCurrency(data.totalUst)}
            </div>
            <p className="text-xs text-text-muted mt-1">
              Eingenommene USt {data.currentYear}
            </p>
          </CardContent>
        </Card>

        {/* Vorsteuer */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-success" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-text-secondary">
                Vorsteuer (VSt)
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-light">
                <ArrowDownLeft className="h-4 w-4 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums">
              {formatCurrency(data.totalVst)}
            </div>
            <p className="text-xs text-text-muted mt-1">
              Abziehbare VSt {data.currentYear}
            </p>
          </CardContent>
        </Card>

        {/* Zahllast */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-info" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-text-secondary">
                Zahllast
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-light">
                <Calculator className="h-4 w-4 text-info" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold font-mono tabular-nums ${
                data.totalZahllast >= 0 ? "text-danger" : "text-success"
              }`}
            >
              {formatCurrency(data.totalZahllast)}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {data.totalZahllast >= 0
                ? "An das Finanzamt zu zahlen"
                : "Erstattung vom Finanzamt"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Quartalsuebersicht {data.currentYear}
          </CardTitle>
          <CardDescription>
            USt, VSt und Zahllast nach Quartalen
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-t border-border bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Quartal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Umsatzsteuer
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Vorsteuer
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Zahllast
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.quarters.map((q) => (
                  <tr
                    key={q.label}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-6 py-3.5 text-sm font-medium text-text-primary">
                      {q.label} {data.currentYear}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                      {formatCurrency(q.ust)}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                      {formatCurrency(q.vst)}
                    </td>
                    <td
                      className={`px-6 py-3.5 text-sm font-mono tabular-nums text-right font-medium ${
                        q.zahllast >= 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatCurrency(q.zahllast)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50/80 font-semibold">
                  <td className="px-6 py-3.5 text-sm text-text-primary">
                    Gesamt {data.currentYear}
                  </td>
                  <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                    {formatCurrency(data.totalUst)}
                  </td>
                  <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                    {formatCurrency(data.totalVst)}
                  </td>
                  <td
                    className={`px-6 py-3.5 text-sm font-mono tabular-nums text-right ${
                      data.totalZahllast >= 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {formatCurrency(data.totalZahllast)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* UStVA Periods */}
      {data.taxPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  UStVA-Zeitraeume
                </CardTitle>
                <CardDescription>
                  Umsatzsteuer-Voranmeldungen {data.currentYear}
                </CardDescription>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                <FileText className="h-4 w-4 text-text-secondary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-t border-border bg-gray-50/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Typ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Zeitraum
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      USt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      VSt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Zahllast
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.taxPeriods.map((tp) => {
                    const statusConfig = PERIOD_STATUS[tp.status] ?? {
                      label: tp.status,
                      variant: "default" as const,
                    };
                    return (
                      <tr
                        key={tp.id}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-sm text-text-primary">
                          {PERIOD_TYPE_LABELS[tp.type] ?? tp.type}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-text-secondary whitespace-nowrap">
                          {formatDate(tp.periodStart)} –{" "}
                          {formatDate(tp.periodEnd)}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                          {formatCurrency(tp.ustAmount)}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono tabular-nums text-right text-text-primary">
                          {formatCurrency(tp.vstAmount)}
                        </td>
                        <td
                          className={`px-6 py-3.5 text-sm font-mono tabular-nums text-right font-medium ${
                            tp.payloadAmount >= 0
                              ? "text-danger"
                              : "text-success"
                          }`}
                        >
                          {formatCurrency(tp.payloadAmount)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                            {tp.status === "CALCULATED" && (
                              <span className="text-[10px] text-text-muted">
                                Automatisch berechnet am{" "}
                                {formatDate(tp.createdAt)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ELSTER Notice */}
      <Card className="border-info/30 bg-info-light/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-light">
              <Info className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                ELSTER-Anbindung
              </p>
              <p className="text-sm text-text-secondary mt-0.5">
                ELSTER-Anbindung kommt in einer spaeteren Version. UStVA-Daten
                koennen als PDF exportiert werden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
