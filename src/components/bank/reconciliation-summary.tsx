"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Sparkles, PenLine } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface ReconciliationSummaryProps {
  total: number;
  confirmed: number;
  manual: number;
  aiSuggested: number;
  unmatched: number;
}

// ─── Component ──────────────────────────────────────────────────

export function ReconciliationSummary({
  total,
  confirmed,
  manual,
  aiSuggested,
  unmatched,
}: ReconciliationSummaryProps) {
  if (total === 0) return null;

  const matched = confirmed + manual;
  const matchedPercent = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Abstimmungsfortschritt</CardTitle>
          <Badge
            variant={
              matchedPercent === 100
                ? "success"
                : matchedPercent >= 50
                  ? "warning"
                  : "danger"
            }
          >
            {matchedPercent}% zugeordnet
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {/* Confirmed */}
            {confirmed > 0 && (
              <div
                className="bg-success transition-all duration-500"
                style={{ width: `${(confirmed / total) * 100}%` }}
                title={`${confirmed} bestätigt`}
              />
            )}
            {/* Manual */}
            {manual > 0 && (
              <div
                className="bg-info transition-all duration-500"
                style={{ width: `${(manual / total) * 100}%` }}
                title={`${manual} manuell`}
              />
            )}
            {/* AI Suggested */}
            {aiSuggested > 0 && (
              <div
                className="bg-warning transition-all duration-500"
                style={{ width: `${(aiSuggested / total) * 100}%` }}
                title={`${aiSuggested} KI-Vorschläge`}
              />
            )}
            {/* Unmatched fills the rest implicitly via bg-gray-100 */}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span className="text-xs text-text-secondary">
                Bestätigt{" "}
                <span className="font-medium text-text-primary">
                  {confirmed}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PenLine className="h-3.5 w-3.5 text-info" />
              <span className="text-xs text-text-secondary">
                Manuell{" "}
                <span className="font-medium text-text-primary">
                  {manual}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-text-secondary">
                KI-Vorschläge{" "}
                <span className="font-medium text-text-primary">
                  {aiSuggested}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-danger" />
              <span className="text-xs text-text-secondary">
                Offen{" "}
                <span className="font-medium text-text-primary">
                  {unmatched}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Summary Numbers */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-gray-50/50 p-3 text-center">
            <p className="text-lg font-semibold text-text-primary">{total}</p>
            <p className="text-xs text-text-muted">Importiert</p>
          </div>
          <div className="rounded-lg border border-green-100 bg-success-light/30 p-3 text-center">
            <p className="text-lg font-semibold text-success">{matched}</p>
            <p className="text-xs text-text-muted">Zugeordnet</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-warning-light/30 p-3 text-center">
            <p className="text-lg font-semibold text-warning">{aiSuggested}</p>
            <p className="text-xs text-text-muted">Vorschläge</p>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-center",
              unmatched > 0
                ? "border-red-100 bg-danger-light/30"
                : "border-green-100 bg-success-light/30"
            )}
          >
            <p
              className={cn(
                "text-lg font-semibold",
                unmatched > 0 ? "text-danger" : "text-success"
              )}
            >
              {unmatched}
            </p>
            <p className="text-xs text-text-muted">Offen</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
