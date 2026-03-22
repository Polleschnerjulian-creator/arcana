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
import {
  Loader2,
  AlertCircle,
  Printer,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface KassenbuchEntry {
  id: string;
  date: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface KassenbuchDay {
  date: string;
  entries: KassenbuchEntry[];
  einnahmen: number;
  ausgaben: number;
}

interface KassenbuchData {
  account: { id: string; number: string; name: string };
  period: { from: string; to: string };
  openingBalance: number;
  days: KassenbuchDay[];
  closingBalance: number;
  totalEinnahmen: number;
  totalAusgaben: number;
}

interface AccountOption {
  id: string;
  number: string;
  name: string;
}

interface KassenbuchReportProps {
  defaultFrom: string;
  defaultTo: string;
}

// ─── Component ───────────────────────────────────────────────────

export function KassenbuchReport({ defaultFrom, defaultTo }: KassenbuchReportProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [accountNumber, setAccountNumber] = useState("1000");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [data, setData] = useState<KassenbuchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available cash/bank accounts (ASSET, 1000-1299)
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const json = await res.json();
        const allAccounts: AccountOption[] = (json.data || json || []);
        const filtered = allAccounts.filter((a: AccountOption) => {
          const num = parseInt(a.number, 10);
          return num >= 1000 && num <= 1299;
        });
        filtered.sort((a: AccountOption, b: AccountOption) => a.number.localeCompare(b.number));
        setAccounts(filtered);
      } catch {
        // Silently fail — accounts list is optional
      }
    }
    loadAccounts();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/kassenbuch?account=${accountNumber}&from=${from}&to=${to}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Bericht konnte nicht geladen werden.");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }, [accountNumber, from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
                  htmlFor="kassenbuch-account"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Konto
                </label>
                <select
                  id="kassenbuch-account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="flex h-10 w-52 rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]"
                >
                  {accounts.length > 0 ? (
                    accounts.map((acc) => (
                      <option key={acc.id} value={acc.number}>
                        {acc.number} – {acc.name}
                      </option>
                    ))
                  ) : (
                    <option value="1000">1000 – Kasse</option>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-[var(--color-danger)]">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* Kassenbuch Table */}
      {data && (
        <div id="kassenbuch-report">
          <Card className="print:border-0 print:shadow-none overflow-hidden">
            <CardHeader className="border-b border-[var(--glass-border)] text-center">
              {/* Print header with org name */}
              <CardTitle className="text-xl">Kassenbuch</CardTitle>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Konto {data.account.number} – {data.account.name}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Zeitraum: {formatPeriodLabel()}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-[var(--glass-border)]">
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Datum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-28">
                        Beleg
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Buchungstext
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-36">
                        Einnahme (Soll)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-36">
                        Ausgabe (Haben)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-36">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening Balance Row */}
                    <tr className="border-b border-[var(--glass-border)] bg-black/[0.02] dark:bg-white/[0.02]">
                      <td className="px-6 py-3 text-sm font-semibold text-[var(--color-text)]" colSpan={5}>
                        Anfangsbestand
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold font-mono tabular-nums text-right text-[var(--color-text)]">
                        {formatCurrency(data.openingBalance)}
                      </td>
                    </tr>

                    {/* Day Groups */}
                    {data.days.map((day) => (
                      <DayGroup key={day.date} day={day} />
                    ))}

                    {/* Closing Balance Row */}
                    <tr className="border-t-2 border-[var(--glass-border)] bg-black/[0.03] dark:bg-white/[0.03]">
                      <td className="px-6 py-4 text-sm font-bold text-[var(--color-text)]" colSpan={3}>
                        Endbestand
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(data.totalEinnahmen)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-red-500 dark:text-red-400">
                        {formatCurrency(data.totalAusgaben)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-[var(--color-text)]">
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
          #kassenbuch-report,
          #kassenbuch-report * {
            visibility: visible;
          }
          #kassenbuch-report {
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

// ─── Sub-Components ──────────────────────────────────────────────

function DayGroup({ day }: { day: { date: string; entries: KassenbuchEntry[]; einnahmen: number; ausgaben: number } }) {
  return (
    <>
      {/* Individual Entries */}
      {day.entries.map((entry) => (
        <tr
          key={entry.id}
          className="border-b border-[var(--glass-border)]/50 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
        >
          <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">
            {formatDate(entry.date)}
          </td>
          <td className="px-6 py-3 text-sm font-mono text-[var(--color-text-secondary)]">
            {entry.reference || "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--color-text)]">
            {entry.description}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right">
            {entry.debit > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatCurrency(entry.debit)}
              </span>
            ) : (
              <span className="text-[var(--color-text-tertiary)]">—</span>
            )}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right">
            {entry.credit > 0 ? (
              <span className="text-red-500 dark:text-red-400">
                {formatCurrency(entry.credit)}
              </span>
            ) : (
              <span className="text-[var(--color-text-tertiary)]">—</span>
            )}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-[var(--color-text)]">
            {formatCurrency(entry.runningBalance)}
          </td>
        </tr>
      ))}

      {/* Daily Subtotal */}
      {day.entries.length > 1 && (
        <tr className="border-b border-[var(--glass-border)] bg-black/[0.015] dark:bg-white/[0.015]">
          <td className="px-6 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
            {formatDate(day.date)}
          </td>
          <td className="px-6 py-2 text-xs font-medium text-[var(--color-text-tertiary)]" colSpan={2}>
            Tagessumme
          </td>
          <td className="px-6 py-2 text-xs font-medium font-mono tabular-nums text-right text-emerald-600 dark:text-emerald-400">
            {formatCurrency(day.einnahmen)}
          </td>
          <td className="px-6 py-2 text-xs font-medium font-mono tabular-nums text-right text-red-500 dark:text-red-400">
            {formatCurrency(day.ausgaben)}
          </td>
          <td className="px-6 py-2" />
        </tr>
      )}
    </>
  );
}
