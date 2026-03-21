"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiSuggestionCard } from "./ai-suggestion-card";
import { formatDate } from "@/lib/utils";
import type { AiExtraction, OcrStatus } from "@/types";
import {
  FileText,
  Image as ImageIcon,
  Download,
  ScanText,
  Sparkles,
  Loader2,
  Hash,
  Calendar,
  HardDrive,
  FileType,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface DocumentData {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  sha256Hash: string;
  uploadedAt: string;
  ocrText: string | null;
  ocrStatus: OcrStatus;
  aiExtraction: string | null;
  type: string;
  transactions?: { id: string; description: string; status: string }[];
}

interface DocumentDetailProps {
  document: DocumentData;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INCOMING_INVOICE: "Eingangsrechnung",
    OUTGOING_INVOICE: "Ausgangsrechnung",
    RECEIPT: "Kassenbon",
    BANK_STATEMENT: "Kontoauszug",
    OTHER: "Sonstiges",
  };
  return labels[type] || type;
}

function getOcrStatusBadge(status: OcrStatus) {
  switch (status) {
    case "DONE":
      return <Badge variant="success">OCR abgeschlossen</Badge>;
    case "PROCESSING":
      return <Badge variant="info">OCR läuft...</Badge>;
    case "FAILED":
      return <Badge variant="danger">OCR fehlgeschlagen</Badge>;
    default:
      return <Badge variant="default">OCR ausstehend</Badge>;
  }
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdfMime(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentDetail({ document: initialDoc }: DocumentDetailProps) {
  const [doc, setDoc] = useState<DocumentData>(initialDoc);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse AI extraction if present
  const aiExtraction: AiExtraction | null = doc.aiExtraction
    ? (() => {
        try {
          return JSON.parse(doc.aiExtraction);
        } catch {
          return null;
        }
      })()
    : null;

  // ─── OCR starten ────────────────────────────────────────────

  const handleStartOcr = useCallback(async () => {
    setOcrLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}/ocr`, {
        method: "POST",
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "OCR fehlgeschlagen.");
        return;
      }

      setDoc((prev) => ({
        ...prev,
        ocrText: data.data.ocrText,
        ocrStatus: data.data.ocrStatus,
      }));
    } catch {
      setError("Netzwerkfehler beim Starten der OCR.");
    } finally {
      setOcrLoading(false);
    }
  }, [doc.id]);

  // ─── KI-Analyse starten ────────────────────────────────────

  const handleStartExtraction = useCallback(async () => {
    setExtractLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}/extract`, {
        method: "POST",
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "KI-Analyse fehlgeschlagen.");
        return;
      }

      setDoc((prev) => ({
        ...prev,
        aiExtraction: JSON.stringify(data.data.aiExtraction),
      }));
    } catch {
      setError("Netzwerkfehler beim Starten der KI-Analyse.");
    } finally {
      setExtractLoading(false);
    }
  }, [doc.id]);

  // ─── Booking created callback ──────────────────────────────

  const handleBookingCreated = useCallback((transactionId: string) => {
    setDoc((prev) => ({
      ...prev,
      transactions: [
        ...(prev.transactions || []),
        {
          id: transactionId,
          description: "KI-Buchung (Entwurf)",
          status: "DRAFT",
        },
      ],
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-light border border-red-200 p-4">
          <AlertCircle className="h-5 w-5 text-danger mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-danger">Fehler</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Document metadata */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              {isImageMime(doc.mimeType) ? (
                <ImageIcon className="h-5 w-5 text-text-secondary" />
              ) : (
                <FileText className="h-5 w-5 text-text-secondary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{doc.fileName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">
                  {getDocumentTypeLabel(doc.type)}
                </Badge>
                {getOcrStatusBadge(doc.ocrStatus as OcrStatus)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-start gap-2">
              <FileType className="h-4 w-4 text-text-muted mt-0.5" />
              <div>
                <p className="text-xs text-text-secondary">Format</p>
                <p className="text-sm font-medium text-text-primary">
                  {doc.mimeType.split("/")[1]?.toUpperCase() || doc.mimeType}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <HardDrive className="h-4 w-4 text-text-muted mt-0.5" />
              <div>
                <p className="text-xs text-text-secondary">Größe</p>
                <p className="text-sm font-medium text-text-primary">
                  {formatFileSize(doc.fileSize)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-text-muted mt-0.5" />
              <div>
                <p className="text-xs text-text-secondary">Hochgeladen</p>
                <p className="text-sm font-medium text-text-primary">
                  {formatDate(doc.uploadedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Hash className="h-4 w-4 text-text-muted mt-0.5" />
              <div>
                <p className="text-xs text-text-secondary">SHA-256</p>
                <p
                  className="text-sm font-mono text-text-primary truncate max-w-[160px]"
                  title={doc.sha256Hash}
                >
                  {doc.sha256Hash.slice(0, 16)}...
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau</CardTitle>
        </CardHeader>
        <CardContent>
          {isImageMime(doc.mimeType) ? (
            <div className="rounded-lg border border-border overflow-hidden bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.storagePath.startsWith("http") ? doc.storagePath : `/api/documents/${doc.id}/file`}
                alt={doc.fileName}
                className="max-w-full h-auto max-h-[500px] object-contain mx-auto"
              />
            </div>
          ) : isPdfMime(doc.mimeType) ? (
            <div className="flex flex-col items-center gap-3 py-8 text-text-secondary">
              <FileText className="h-12 w-12 text-text-muted" />
              <p className="text-sm">PDF-Vorschau nicht verfügbar</p>
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={doc.storagePath.startsWith("http") ? doc.storagePath : `/api/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                  PDF herunterladen
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-text-secondary">
              <FileText className="h-12 w-12 text-text-muted" />
              <p className="text-sm">Vorschau für dieses Format nicht verfügbar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanText className="h-5 w-5 text-text-secondary" />
              <CardTitle className="text-base">OCR-Texterkennung</CardTitle>
            </div>
            {doc.ocrStatus === "PENDING" && (
              <Button
                size="sm"
                onClick={handleStartOcr}
                disabled={ocrLoading}
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird verarbeitet...
                  </>
                ) : (
                  <>
                    <ScanText className="h-4 w-4" />
                    OCR starten
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {doc.ocrText ? (
            <div>
              <button
                onClick={() => setOcrExpanded(!ocrExpanded)}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors mb-2"
              >
                {ocrExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    OCR-Text ausblenden
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    OCR-Text anzeigen
                  </>
                )}
              </button>
              {ocrExpanded && (
                <pre className="rounded-lg bg-gray-50 border border-border p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap overflow-auto max-h-[400px]">
                  {doc.ocrText}
                </pre>
              )}
            </div>
          ) : doc.ocrStatus === "FAILED" ? (
            <p className="text-sm text-danger">
              Die Texterkennung ist fehlgeschlagen. Bitte versuchen Sie es
              erneut oder laden Sie das Dokument in besserer Qualität hoch.
            </p>
          ) : doc.ocrStatus === "PROCESSING" ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Texterkennung läuft...
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Starten Sie die OCR-Texterkennung, um den Beleginhalt zu
              analysieren.
            </p>
          )}
        </CardContent>
      </Card>

      {/* KI-Analyse action (when OCR is done but no extraction yet) */}
      {doc.ocrStatus === "DONE" && !aiExtraction && (
        <Card className="border-teal-200 bg-teal-50/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    KI-Analyse verfügbar
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Rechnungsdaten automatisch erkennen und Buchung vorschlagen
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStartExtraction}
                disabled={extractLoading}
              >
                {extractLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    KI-Analyse starten
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Extraction results */}
      {aiExtraction && (
        <AiSuggestionCard
          documentId={doc.id}
          extraction={aiExtraction}
          onBookingCreated={handleBookingCreated}
        />
      )}

      {/* Linked transactions */}
      {doc.transactions && doc.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verknüpfte Buchungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {doc.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-primary">
                      {tx.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        tx.status === "BOOKED"
                          ? "success"
                          : tx.status === "CANCELLED"
                            ? "danger"
                            : "default"
                      }
                    >
                      {tx.status === "BOOKED"
                        ? "Gebucht"
                        : tx.status === "CANCELLED"
                          ? "Storniert"
                          : "Entwurf"}
                    </Badge>
                    <a
                      href={`/transactions/${tx.id}`}
                      className="text-primary hover:text-primary-hover transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
