"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AiExtraction } from "@/types";
import {
  Sparkles,
  FileCheck,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface AiSuggestionCardProps {
  documentId: string;
  extraction: AiExtraction;
  onBookingCreated?: (transactionId: string) => void;
}

// ─── Confidence Badge ────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) {
    return (
      <Badge
        variant="success"
        className="inline-flex items-center gap-1.5 px-3 py-1"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Hohe Sicherheit ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }

  if (confidence >= 0.5) {
    return (
      <Badge
        variant="warning"
        className="inline-flex items-center gap-1.5 px-3 py-1"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        Mittlere Sicherheit ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }

  return (
    <Badge
      variant="danger"
      className="inline-flex items-center gap-1.5 px-3 py-1"
    >
      <Shield className="h-3.5 w-3.5" />
      Niedrige Sicherheit ({Math.round(confidence * 100)}%)
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function AiSuggestionCard({
  documentId,
  extraction,
  onBookingCreated,
}: AiSuggestionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  async function handleCreateBooking() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/book`, {
        method: "POST",
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Buchung konnte nicht erstellt werden.");
        return;
      }

      setBooked(true);
      setTransactionId(data.data?.id || null);
      onBookingCreated?.(data.data?.id);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50/40 via-white to-teal-50/20 overflow-hidden">
      {/* Subtle decorative top bar */}
      <div className="h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
              <Sparkles className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-base">KI-Analyse</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Automatisch erkannte Rechnungsdaten
              </CardDescription>
            </div>
          </div>
          <ConfidenceBadge confidence={extraction.confidence} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Main extracted fields */}
        <div className="grid grid-cols-2 gap-4">
          {/* Vendor */}
          {extraction.vendor && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                Lieferant
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {extraction.vendor}
              </p>
            </div>
          )}

          {/* Invoice number */}
          {extraction.invoiceNumber && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                Rechnungsnummer
              </p>
              <p className="text-sm font-mono text-text-primary">
                {extraction.invoiceNumber}
              </p>
            </div>
          )}

          {/* Date */}
          {extraction.invoiceDate && (
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                Datum
              </p>
              <p className="text-sm text-text-primary">
                {formatDate(extraction.invoiceDate)}
              </p>
            </div>
          )}
        </div>

        {/* Amount breakdown */}
        <div className="rounded-lg border border-teal-100 bg-white/80 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Beträge
            </p>
          </div>
          <div className="space-y-2">
            {extraction.netAmount != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Netto</span>
                <span className="text-sm font-mono font-medium text-text-primary">
                  {formatCurrency(extraction.netAmount)}
                </span>
              </div>
            )}
            {extraction.taxRate != null && extraction.taxAmount != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  MwSt. {extraction.taxRate}%
                </span>
                <span className="text-sm font-mono font-medium text-text-secondary">
                  {formatCurrency(extraction.taxAmount)}
                </span>
              </div>
            )}
            {extraction.amount != null && (
              <>
                <div className="border-t border-teal-100 my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">
                    Brutto
                  </span>
                  <span className="text-base font-mono font-bold text-teal-700">
                    {formatCurrency(extraction.amount)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Line items table */}
        {extraction.lineItems && extraction.lineItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Positionen
            </p>
            <div className="rounded-lg border border-teal-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-50/60">
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">
                      Beschreibung
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary w-16">
                      Menge
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary w-24">
                      E-Preis
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary w-24">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {extraction.lineItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-teal-50 hover:bg-teal-50/30 transition-colors"
                    >
                      <td className="py-2 px-3 text-text-primary">
                        {item.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-text-secondary">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-text-secondary">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-text-primary">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-light border border-red-200 p-3">
            <AlertCircle className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Success message */}
        {booked && (
          <div className="flex items-start gap-2 rounded-lg bg-success-light border border-green-200 p-3">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-success">
                Entwurfsbuchung erfolgreich erstellt!
              </p>
              {transactionId && (
                <p className="text-xs text-green-600 mt-0.5">
                  Buchung-ID: {transactionId.slice(0, 12)}...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-3 pt-2">
        <Button
          onClick={handleCreateBooking}
          disabled={loading || booked}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird erstellt...
            </>
          ) : booked ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Buchung erstellt
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4" />
              Buchung erstellen
            </>
          )}
        </Button>
        <Button variant="secondary" disabled className="flex-1">
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </Button>
      </CardFooter>
    </Card>
  );
}
