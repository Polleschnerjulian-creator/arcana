"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  Loader2,
  AlertCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface BWAPosition {
  position: number;
  label: string;
  currentMonth: number;
  ytd: number;
  isSubtotal: boolean;
  isResult: boolean;
}

interface BWAData {
  year: number;
  month: number;
  monthLabel: string;
  positions: BWAPosition[];
}

interface BWAReportProps {
  defaultYear: number;
  defaultMonth: number;
}

// ─── Month Names ─────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// ─── Component ───────────────────────────────────────────────────

export function BWAReport({ defaultYear, defaultMonth }: BWAReportProps) {
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<BWAData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/bwa?year=${year}&month=${month}`);
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
  }, [year, month]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function goToPreviousMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function handlePrint() {
    window.print();
  }

  function formatAmount(amount: number): string {
    return formatCurrency(amount);
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[180px]">
                <p className="text-base font-semibold text-text-primary">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
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

      {/* BWA Table */}
      {data && (
        <div id="bwa-report">
          <Card className="print:border-0 print:shadow-none overflow-hidden">
            <CardHeader className="border-b border-border text-center">
              <CardTitle className="text-xl">
                Betriebswirtschaftliche Auswertung
              </CardTitle>
              <p className="text-sm text-text-secondary">
                {MONTH_NAMES[data.month - 1]} {data.year}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-12">
                        Pos.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Bezeichnung
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-40">
                        {MONTH_NAMES[data.month - 1]}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-40">
                        Kumuliert (YTD)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((pos, idx) => {
                      const isNegativeMonth = pos.currentMonth < 0;
                      const isNegativeYTD = pos.ytd < 0;
                      const isHighlightRow = pos.isSubtotal || pos.isResult;

                      return (
                        <tr
                          key={`${pos.position}-${idx}`}
                          className={`
                            border-b border-border/50 transition-colors
                            ${isHighlightRow ? "bg-gray-50/60" : "hover:bg-gray-50/30"}
                            ${pos.isResult ? "border-t-2 border-t-border" : ""}
                          `}
                        >
                          {/* Position */}
                          <td className="px-6 py-3 text-sm text-text-muted font-mono">
                            {pos.position > 0 ? pos.position : ""}
                          </td>

                          {/* Bezeichnung */}
                          <td
                            className={`px-6 py-3 text-sm text-text-primary ${
                              isHighlightRow ? "font-semibold" : ""
                            } ${pos.isResult ? "text-base" : ""}`}
                          >
                            {pos.label}
                          </td>

                          {/* Aktueller Monat */}
                          <td
                            className={`px-6 py-3 text-sm font-mono tabular-nums text-right whitespace-nowrap ${
                              isHighlightRow ? "font-semibold" : ""
                            } ${pos.isResult ? "text-base" : ""} ${
                              isNegativeMonth ? "text-danger" : "text-text-primary"
                            }`}
                          >
                            {pos.currentMonth === 0 && !pos.isSubtotal && !pos.isResult
                              ? "—"
                              : formatAmount(pos.currentMonth)}
                          </td>

                          {/* Kumuliert */}
                          <td
                            className={`px-6 py-3 text-sm font-mono tabular-nums text-right whitespace-nowrap ${
                              isHighlightRow ? "font-semibold" : ""
                            } ${pos.isResult ? "text-base" : ""} ${
                              isNegativeYTD ? "text-danger" : "text-text-primary"
                            }`}
                          >
                            {pos.ytd === 0 && !pos.isSubtotal && !pos.isResult
                              ? "—"
                              : formatAmount(pos.ytd)}
                          </td>
                        </tr>
                      );
                    })}
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
          #bwa-report,
          #bwa-report * {
            visibility: visible;
          }
          #bwa-report {
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
