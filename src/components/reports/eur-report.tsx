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
  ChevronDown,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface EURAccount {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface EURCategory {
  category: string;
  total: number;
  accounts: EURAccount[];
}

interface EURData {
  period: { from: string; to: string };
  revenue: {
    categories: EURCategory[];
    total: number;
  };
  expenses: {
    categories: EURCategory[];
    total: number;
  };
  result: number;
}

interface EURReportProps {
  defaultFrom: string;
  defaultTo: string;
}

// ─── Component ───────────────────────────────────────────────────

export function EURReport({ defaultFrom, defaultTo }: EURReportProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<EURData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/eur?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Bericht konnte nicht geladen werden.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function toggleCategory(key: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleCsvExport() {
    try {
      const res = await fetch(`/api/export/csv?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Export fehlgeschlagen.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eur_${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("CSV-Export fehlgeschlagen.");
    }
  }

  function handlePrint() {
    window.print();
  }

  // Format period label
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
        <div className="print:shadow-none" id="eur-report">
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b border-border">
              <div className="text-center space-y-1">
                <CardTitle className="text-xl">
                  Einnahmenüberschussrechnung
                </CardTitle>
                <p className="text-sm text-text-secondary">
                  Zeitraum: {formatPeriodLabel()}
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Betriebseinnahmen */}
              <div className="border-b border-border">
                <div className="flex items-center justify-between px-6 py-4 bg-success-light/50">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                      Betriebseinnahmen
                    </h3>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-success">
                    {formatCurrency(data.revenue.total)}
                  </span>
                </div>

                <div className="divide-y divide-border/50">
                  {data.revenue.categories.map((cat) => {
                    const key = `rev-${cat.category}`;
                    const isExpanded = expandedCategories.has(key);
                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleCategory(key)}
                          className="flex items-center justify-between w-full px-6 py-3 hover:bg-gray-50/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-text-muted" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-text-muted" />
                            )}
                            <span className="text-sm text-text-primary">
                              {cat.category}
                            </span>
                          </div>
                          <span className="text-sm font-mono tabular-nums text-success">
                            {formatCurrency(cat.total)}
                          </span>
                        </button>

                        {isExpanded && cat.accounts.length > 0 && (
                          <div className="bg-gray-50/30 border-t border-border/30">
                            {cat.accounts.map((acc) => (
                              <div
                                key={acc.accountNumber}
                                className="flex items-center justify-between px-6 py-2 pl-14"
                              >
                                <span className="text-xs text-text-secondary">
                                  <span className="font-mono text-text-muted">{acc.accountNumber}</span>
                                  {" "}
                                  {acc.accountName}
                                </span>
                                <span className="text-xs font-mono tabular-nums text-text-secondary">
                                  {formatCurrency(acc.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Betriebsausgaben */}
              <div className="border-b border-border">
                <div className="flex items-center justify-between px-6 py-4 bg-danger-light/50">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-danger" />
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                      Betriebsausgaben
                    </h3>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-danger">
                    {formatCurrency(data.expenses.total)}
                  </span>
                </div>

                <div className="divide-y divide-border/50">
                  {data.expenses.categories.map((cat) => {
                    const key = `exp-${cat.category}`;
                    const isExpanded = expandedCategories.has(key);
                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleCategory(key)}
                          className="flex items-center justify-between w-full px-6 py-3 hover:bg-gray-50/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-text-muted" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-text-muted" />
                            )}
                            <span className="text-sm text-text-primary">
                              {cat.category}
                            </span>
                          </div>
                          <span className="text-sm font-mono tabular-nums text-danger">
                            {formatCurrency(cat.total)}
                          </span>
                        </button>

                        {isExpanded && cat.accounts.length > 0 && (
                          <div className="bg-gray-50/30 border-t border-border/30">
                            {cat.accounts.map((acc) => (
                              <div
                                key={acc.accountNumber}
                                className="flex items-center justify-between px-6 py-2 pl-14"
                              >
                                <span className="text-xs text-text-secondary">
                                  <span className="font-mono text-text-muted">{acc.accountNumber}</span>
                                  {" "}
                                  {acc.accountName}
                                </span>
                                <span className="text-xs font-mono tabular-nums text-text-secondary">
                                  {formatCurrency(acc.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ergebnis */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">
                      {data.result >= 0 ? "Gewinn" : "Verlust"}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Betriebseinnahmen abzüglich Betriebsausgaben
                    </p>
                  </div>
                  <span
                    className={`text-xl font-bold font-mono tabular-nums ${
                      data.result >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatCurrency(data.result)}
                  </span>
                </div>
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
          #eur-report,
          #eur-report * {
            visibility: visible;
          }
          #eur-report {
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
