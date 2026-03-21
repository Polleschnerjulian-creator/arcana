"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AiExtraction } from "@/types";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Trash2,
  ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface TransactionLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  taxRate: number | null;
  note: string | null;
  account: {
    id: string;
    number: string;
    name: string;
    type: string;
  };
}

interface DraftTransaction {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  aiConfidence: number | null;
  lines: TransactionLine[];
}

export interface ReviewDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  type: string;
  ocrStatus: string;
  aiExtraction: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; name: string };
  transaction: DraftTransaction | null;
}

interface DocumentReviewPanelProps {
  document: ReviewDocument;
  onConfirmed?: (documentId: string) => void;
  onRejected?: (documentId: string) => void;
}

// ─── Pipeline Step Indicator ─────────────────────────────────────

type StepStatus = "done" | "processing" | "failed" | "pending";

function PipelineStep({
  label,
  status,
  isLast,
}: {
  label: string;
  status: StepStatus;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {status === "done" && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        )}
        {status === "processing" && (
          <Loader2 className="h-4 w-4 text-sky-500 animate-spin flex-shrink-0" />
        )}
        {status === "failed" && (
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        )}
        {status === "pending" && (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
        )}
        <span
          className={`text-xs font-medium ${
            status === "done"
              ? "text-emerald-600"
              : status === "processing"
                ? "text-sky-600"
                : status === "failed"
                  ? "text-red-500"
                  : "text-gray-400"
          }`}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
      )}
    </div>
  );
}

// ─── Confidence Badge ────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) {
    return (
      <Badge
        variant="success"
        className="inline-flex items-center gap-1 px-2.5 py-0.5"
      >
        <ShieldCheck className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge
        variant="warning"
        className="inline-flex items-center gap-1 px-2.5 py-0.5"
      >
        <ShieldAlert className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  return (
    <Badge
      variant="danger"
      className="inline-flex items-center gap-1 px-2.5 py-0.5"
    >
      <Shield className="h-3 w-3" />
      {Math.round(confidence * 100)}%
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentReviewPanel({
  document: doc,
  onConfirmed,
  onRejected,
}: DocumentReviewPanelProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse AI extraction
  const extraction: AiExtraction | null = doc.aiExtraction
    ? (() => {
        try {
          return JSON.parse(doc.aiExtraction) as AiExtraction;
        } catch {
          return null;
        }
      })()
    : null;

  // Derive pipeline step statuses
  const ocrStep: StepStatus =
    doc.ocrStatus === "DONE"
      ? "done"
      : doc.ocrStatus === "PROCESSING"
        ? "processing"
        : doc.ocrStatus === "FAILED"
          ? "failed"
          : "pending";

  const aiStep: StepStatus =
    extraction !== null
      ? "done"
      : doc.ocrStatus === "DONE"
        ? "failed"
        : doc.ocrStatus === "FAILED"
          ? "pending"
          : "pending";

  const bookingStep: StepStatus =
    doc.transaction
      ? "done"
      : extraction !== null
        ? "failed"
        : "pending";

  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";

  // ─── Actions ──────────────────────────────────────────────────

  async function handleConfirm() {
    if (!doc.transaction) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${doc.transaction.id}/book`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Buchung konnte nicht bestaetigt werden.");
        return;
      }

      setConfirmed(true);
      onConfirmed?.(doc.id);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleReject() {
    if (!doc.transaction) return;
    setRejecting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/transactions/${doc.transaction.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Ablehnung fehlgeschlagen.");
        return;
      }

      setRejected(true);
      onRejected?.(doc.id);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setRejecting(false);
    }
  }

  function handleEdit() {
    router.push(`/transactions/new?from=${doc.id}`);
  }

  // ─── Confirmed State ─────────────────────────────────────────

  if (confirmed) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Buchung bestaetigt
              </p>
              <p className="text-xs text-emerald-600">
                {doc.fileName} wurde erfolgreich gebucht.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Rejected State ───────────────────────────────────────────

  if (rejected) {
    return (
      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-700">
                Manuelle Buchung erforderlich
              </p>
              <p className="text-xs text-amber-600">
                Der Buchungsvorschlag fuer {doc.fileName} wurde abgelehnt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Main Panel ───────────────────────────────────────────────

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Document Preview */}
          <div className="lg:w-48 flex-shrink-0 bg-gray-50/50 border-b lg:border-b-0 lg:border-r border-[var(--glass-border)] p-4 flex items-center justify-center">
            {isImage ? (
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-white border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/documents/${doc.id}/file`}
                  alt={doc.fileName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                {isPdf ? (
                  <FileText className="h-12 w-12 text-red-400" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                )}
                <p className="text-xs text-[var(--color-text-secondary)] text-center truncate max-w-full px-2">
                  {doc.fileName}
                </p>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex-1 p-5 space-y-4">
            {/* Pipeline Progress */}
            <div className="flex flex-wrap items-center gap-1">
              <PipelineStep label="Texterkennung" status={ocrStep} />
              <PipelineStep label="KI-Extraktion" status={aiStep} />
              <PipelineStep
                label="Buchungsvorschlag"
                status={bookingStep}
                isLast
              />
            </div>

            {/* Extracted Data */}
            {extraction && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Erkannte Daten
                  </h4>
                  <ConfidenceBadge confidence={extraction.confidence} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {extraction.vendor && (
                    <div>
                      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Lieferant
                      </p>
                      <p className="text-sm font-medium text-[var(--color-text)] mt-0.5">
                        {extraction.vendor}
                      </p>
                    </div>
                  )}
                  {extraction.invoiceNumber && (
                    <div>
                      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Rechnungsnr.
                      </p>
                      <p className="text-sm font-mono text-[var(--color-text)] mt-0.5">
                        {extraction.invoiceNumber}
                      </p>
                    </div>
                  )}
                  {extraction.invoiceDate && (
                    <div>
                      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Datum
                      </p>
                      <p className="text-sm text-[var(--color-text)] mt-0.5">
                        {formatDate(extraction.invoiceDate)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Amounts */}
                <div className="rounded-lg border border-[var(--glass-border)] bg-white/50 p-3 space-y-1.5">
                  {extraction.netAmount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Netto
                      </span>
                      <span className="text-sm font-mono font-medium text-[var(--color-text)]">
                        {formatCurrency(extraction.netAmount)}
                      </span>
                    </div>
                  )}
                  {extraction.taxRate != null &&
                    extraction.taxAmount != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          MwSt. {extraction.taxRate}%
                        </span>
                        <span className="text-sm font-mono text-[var(--color-text-secondary)]">
                          {formatCurrency(extraction.taxAmount)}
                        </span>
                      </div>
                    )}
                  {extraction.amount != null && (
                    <>
                      <div className="border-t border-[var(--glass-border)]" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--color-text)]">
                          Brutto
                        </span>
                        <span className="text-sm font-mono font-bold text-[var(--color-text)]">
                          {formatCurrency(extraction.amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Booking Preview */}
            {doc.transaction && doc.transaction.lines.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[var(--color-text)]">
                  Buchungsvorschlag
                </h4>
                <div className="rounded-lg border border-[var(--glass-border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50/60">
                        <th className="text-left py-1.5 px-3 font-medium text-[var(--color-text-secondary)]">
                          S/H
                        </th>
                        <th className="text-left py-1.5 px-3 font-medium text-[var(--color-text-secondary)]">
                          Konto
                        </th>
                        <th className="text-right py-1.5 px-3 font-medium text-[var(--color-text-secondary)]">
                          Betrag
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.transaction.lines.map((line) => {
                        const isDebit = line.debit > 0;
                        const amount = isDebit ? line.debit : line.credit;
                        return (
                          <tr
                            key={line.id}
                            className="border-t border-gray-100"
                          >
                            <td className="py-1.5 px-3">
                              <span
                                className={`font-semibold ${
                                  isDebit
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {isDebit ? "S" : "H"}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-[var(--color-text)]">
                              <span className="font-mono">
                                {line.account.number}
                              </span>{" "}
                              {line.account.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-medium text-[var(--color-text)]">
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No AI / OCR failed messages */}
            {doc.ocrStatus === "DONE" && !extraction && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  KI-Extraktion fehlgeschlagen. Bitte buchen Sie diesen Beleg
                  manuell.
                </p>
              </div>
            )}
            {doc.ocrStatus === "FAILED" && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">
                  Texterkennung fehlgeschlagen. Bitte buchen Sie diesen Beleg
                  manuell.
                </p>
              </div>
            )}
            {(doc.ocrStatus === "PENDING" ||
              doc.ocrStatus === "PROCESSING") && (
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 p-3">
                <Loader2 className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0 animate-spin" />
                <p className="text-xs text-sky-700">
                  Beleg wird verarbeitet...
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {doc.transaction && (
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || rejecting}
                  size="sm"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Wird gebucht...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Buchung bestaetigen
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={handleEdit}
                disabled={confirming || rejecting}
                size="sm"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Button>

              {doc.transaction && (
                <Button
                  variant="ghost"
                  onClick={handleReject}
                  disabled={confirming || rejecting}
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  {rejecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Wird abgelehnt...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Ablehnen
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
