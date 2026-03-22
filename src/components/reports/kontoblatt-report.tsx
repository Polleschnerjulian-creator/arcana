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
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer, Loader2, AlertCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface AccountOption {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface KontoblattEntry {
  date: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface KontoblattData {
  account: {
    number: string;
    name: string;
    type: string;
  };
  period: { from: string; to: string };
  openingBalance: number;
  entries: KontoblattEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

interface KontoblattReportProps {
  defaultFrom: string;
  defaultTo: string;
}

// ─── Component ───────────────────────────────────────────────────

export function KontoblattReport({
  defaultFrom,
  defaultTo,
}: KontoblattReportProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [data, setData] = useState<KontoblattData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts?active=true");
        if (!res.ok) throw new Error("Konten konnten nicht geladen werden.");
        const json = await res.json();
        const accountList = (json.data || []).map(
          (acc: { id: string; number: string; name: string; type: string }) => ({
            id: acc.id,
            number: acc.number,
            name: acc.name,
            type: acc.type,
          })
        );
        setAccounts(accountList);
        if (accountList.length > 0) {
          setSelectedAccount(accountList[0].number);
        }
      } catch {
        setError("Konten konnten nicht geladen werden.");
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedAccount) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/kontoblatt?account=${selectedAccount}&from=${from}&to=${to}`
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
  }, [selectedAccount, from, to]);

  // Auto-fetch when account or dates change
  useEffect(() => {
    if (selectedAccount) {
      fetchReport();
    }
  }, [fetchReport, selectedAccount]);

  function handlePrint() {
    window.print();
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
            <div className="flex items-end gap-3 flex-1 flex-wrap">
              {/* Account Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="account-select"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Konto
                </label>
                <select
                  id="account-select"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={loadingAccounts}
                  className="flex h-10 w-64 rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingAccounts ? (
                    <option value="">Laden...</option>
                  ) : accounts.length === 0 ? (
                    <option value="">Keine Konten vorhanden</option>
                  ) : (
                    accounts.map((acc) => (
                      <option key={acc.id} value={acc.number}>
                        {acc.number} – {acc.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

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
              <Button
                onClick={fetchReport}
                disabled={loading || !selectedAccount}
              >
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
        <div id="kontoblatt-report">
          <Card className="print:border-0 print:shadow-none overflow-hidden">
            <CardHeader className="border-b border-border text-center">
              <CardTitle className="text-xl">Kontoblatt</CardTitle>
              <p className="text-sm text-text-secondary">
                {data.account.number} – {data.account.name}
              </p>
              <p className="text-xs text-text-muted">
                Zeitraum: {formatPeriodLabel()}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-white/5 border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-28">
                        Datum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-28">
                        Beleg
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Buchungstext
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
                        Soll
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
                        Haben
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-36">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening Balance Row */}
                    <tr className="bg-gray-50/40 dark:bg-white/3 border-b border-border">
                      <td className="px-6 py-3 text-sm text-text-muted" colSpan={3}>
                        <span className="font-semibold text-text-primary">
                          Anfangsbestand
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-muted">
                        —
                      </td>
                      <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-muted">
                        —
                      </td>
                      <td
                        className={`px-6 py-3 text-sm font-semibold font-mono tabular-nums text-right whitespace-nowrap ${
                          data.openingBalance < 0
                            ? "text-danger"
                            : "text-text-primary"
                        }`}
                      >
                        {formatCurrency(data.openingBalance)}
                      </td>
                    </tr>

                    {/* Entry Rows */}
                    {data.entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-sm text-text-muted text-center"
                        >
                          Keine Buchungen im gewaehlten Zeitraum.
                        </td>
                      </tr>
                    ) : (
                      data.entries.map((entry, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-border/50 hover:bg-gray-50/30 dark:hover:bg-white/3 transition-colors"
                        >
                          <td className="px-6 py-3 text-sm text-text-primary whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono text-text-muted">
                            {entry.reference || "—"}
                          </td>
                          <td className="px-6 py-3 text-sm text-text-primary">
                            {entry.description}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                            {entry.debit === 0
                              ? "—"
                              : formatCurrency(entry.debit)}
                          </td>
                          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                            {entry.credit === 0
                              ? "—"
                              : formatCurrency(entry.credit)}
                          </td>
                          <td
                            className={`px-6 py-3 text-sm font-mono tabular-nums text-right whitespace-nowrap ${
                              entry.runningBalance < 0
                                ? "text-danger"
                                : "text-text-primary"
                            }`}
                          >
                            {formatCurrency(entry.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Closing Balance Row */}
                    <tr className="border-t-2 border-border bg-gray-50/60 dark:bg-white/5">
                      <td
                        className="px-6 py-4 text-sm font-bold text-text-primary"
                        colSpan={3}
                      >
                        Endbestand
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                        {formatCurrency(data.totalDebit)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
                        {formatCurrency(data.totalCredit)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold font-mono tabular-nums text-right whitespace-nowrap ${
                          data.closingBalance < 0
                            ? "text-danger"
                            : "text-text-primary"
                        }`}
                      >
                        {formatCurrency(data.closingBalance)}
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
          #kontoblatt-report,
          #kontoblatt-report * {
            visibility: visible;
          }
          #kontoblatt-report {
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
