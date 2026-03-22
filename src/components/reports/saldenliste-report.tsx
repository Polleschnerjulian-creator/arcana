"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  Download,
  Printer,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface SaldenAccount {
  number: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface SaldenGroup {
  label: string;
  type: string;
  accounts: SaldenAccount[];
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
}

interface SaldenlisteData {
  period: { from: string; to: string };
  groups: SaldenGroup[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  isBalanced: boolean;
}

interface SaldenlisteReportProps {
  defaultFrom: string;
  defaultTo: string;
}

// ─── Component ───────────────────────────────────────────────────

export function SaldenlisteReport({
  defaultFrom,
  defaultTo,
}: SaldenlisteReportProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<SaldenlisteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/saldenliste?from=${from}&to=${to}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Bericht konnte nicht geladen werden.");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function handlePrint() {
    window.print();
  }

  function handleCsvExport() {
    if (!data) return;

    const rows: string[] = [];
    rows.push("Konto-Nr;Kontoname;Soll;Haben;Saldo");

    for (const group of data.groups) {
      rows.push("");
      rows.push(`--- ${group.label} ---;;;;`);
      for (const acc of group.accounts) {
        rows.push(
          `${acc.number};${acc.name};${formatDecimal(acc.debit)};${formatDecimal(acc.credit)};${formatDecimal(acc.balance)}`
        );
      }
      rows.push(
        `Summe ${group.label};;${formatDecimal(group.totalDebit)};${formatDecimal(group.totalCredit)};${formatDecimal(group.totalBalance)}`
      );
    }

    rows.push("");
    rows.push(
      `Gesamtsumme;;${formatDecimal(data.grandTotalDebit)};${formatDecimal(data.grandTotalCredit)};`
    );

    const bom = "\uFEFF";
    const csvContent = bom + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saldenliste_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatDecimal(value: number): string {
    return value.toFixed(2).replace(".", ",");
  }

  function formatPeriodLabel(): string {
    if (!data) return "";
    const fromDate = new Date(data.period.from);
    const toDate = new Date(data.period.to);
    return `${fromDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} – ${toDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex items-end gap-3 flex-1">
              <Input
                type="date"
                label="Von"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
              <Input
                type="date"
                label="Bis"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
              <Button onClick={fetchReport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laden...
                  </>
                ) : (
                  "Aktualisieren"
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Drucken
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCsvExport}>
                <Download className="h-4 w-4" />
                Als CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-danger">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-danger">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Report Content */}
      {data && (
        <div id="saldenliste-report">
          {/* Balance Warning */}
          {!data.isBalanced && (
            <Card className="border-danger mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-danger">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Soll und Haben stimmen nicht ueberein!
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Gesamtsumme Soll: {formatCurrency(data.grandTotalDebit)} |
                      Gesamtsumme Haben: {formatCurrency(data.grandTotalCredit)} |
                      Differenz:{" "}
                      {formatCurrency(
                        Math.abs(data.grandTotalDebit - data.grandTotalCredit)
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="print:border-0 print:shadow-none overflow-hidden">
            <CardHeader className="border-b border-border text-center">
              <CardTitle className="text-xl">
                Summen- und Saldenliste
              </CardTitle>
              <p className="text-sm text-text-secondary">
                Zeitraum: {formatPeriodLabel()}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-white/5 border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-24">
                        Konto-Nr
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Kontoname
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-36">
                        Soll
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-36">
                        Haben
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-36">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((group) => (
                      <GroupSection key={group.type} group={group} />
                    ))}

                    {/* Grand Total Row */}
                    <tr className="border-t-2 border-border bg-gray-50/60 dark:bg-white/5">
                      <td className="px-6 py-4 text-sm font-bold text-text-primary" colSpan={2}>
                        Gesamtsumme
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                        {formatCurrency(data.grandTotalDebit)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                        {formatCurrency(data.grandTotalCredit)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right whitespace-nowrap">
                        {data.isBalanced ? (
                          <span className="text-success">Ausgeglichen</span>
                        ) : (
                          <span className="text-danger">
                            {formatCurrency(
                              Math.abs(
                                data.grandTotalDebit - data.grandTotalCredit
                              )
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #saldenliste-report,
          #saldenliste-report * {
            visibility: visible;
          }
          #saldenliste-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Group Section Sub-Component ────────────────────────────────

function GroupSection({ group }: { group: SaldenGroup }) {
  return (
    <>
      {/* Group Header */}
      <tr className="bg-gray-50/40 dark:bg-white/3 border-t border-border">
        <td
          colSpan={5}
          className="px-6 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider"
        >
          {group.label}
        </td>
      </tr>

      {/* Account Rows */}
      {group.accounts.map((acc) => (
        <tr
          key={acc.number}
          className="border-b border-border/50 hover:bg-gray-50/30 dark:hover:bg-white/3 transition-colors"
        >
          <td className="px-6 py-3 text-sm font-mono text-text-muted">
            {acc.number}
          </td>
          <td className="px-6 py-3 text-sm text-text-primary">{acc.name}</td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
            {acc.debit === 0 ? "—" : formatCurrency(acc.debit)}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
            {acc.credit === 0 ? "—" : formatCurrency(acc.credit)}
          </td>
          <td
            className={`px-6 py-3 text-sm font-mono tabular-nums text-right whitespace-nowrap ${
              acc.balance < 0 ? "text-danger" : "text-text-primary"
            }`}
          >
            {formatCurrency(acc.balance)}
          </td>
        </tr>
      ))}

      {/* Subtotal Row */}
      <tr className="bg-gray-50/60 dark:bg-white/5 border-b border-border">
        <td className="px-6 py-3 text-sm font-semibold text-text-primary" colSpan={2}>
          Summe {group.label}
        </td>
        <td className="px-6 py-3 text-sm font-semibold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
          {formatCurrency(group.totalDebit)}
        </td>
        <td className="px-6 py-3 text-sm font-semibold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
          {formatCurrency(group.totalCredit)}
        </td>
        <td
          className={`px-6 py-3 text-sm font-semibold font-mono tabular-nums text-right whitespace-nowrap ${
            group.totalBalance < 0 ? "text-danger" : "text-text-primary"
          }`}
        >
          {formatCurrency(group.totalBalance)}
        </td>
      </tr>
    </>
  );
}
