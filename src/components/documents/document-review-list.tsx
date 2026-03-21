"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DocumentReviewPanel,
  type ReviewDocument,
} from "@/components/documents/document-review-panel";
import { CheckCircle2, Loader2, FileSearch } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface DocumentReviewListProps {
  documents: ReviewDocument[];
}

// ─── Component ───────────────────────────────────────────────────

export function DocumentReviewList({
  documents: initialDocuments,
}: DocumentReviewListProps) {
  const [documents, setDocuments] = useState<ReviewDocument[]>(initialDocuments);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // Determine if any documents are still processing (pipeline running)
  const hasProcessingDocs = documents.some(
    (d) => d.ocrStatus === "PENDING" || d.ocrStatus === "PROCESSING"
  );

  // Determine if there are actionable documents (not yet confirmed/rejected)
  const hasActionableDocs = documents.some(
    (d) => !confirmedIds.has(d.id) && !rejectedIds.has(d.id)
  );

  // Poll for updates
  const fetchPendingReview = useCallback(async () => {
    try {
      const res = await fetch("/api/documents/pending-review");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDocuments(data.data);
        }
      }
    } catch {
      // Silently fail — will retry on next interval
    }
  }, []);

  useEffect(() => {
    // Only poll if there are still processing documents or actionable docs
    if (!hasProcessingDocs && !hasActionableDocs) return;

    const interval = setInterval(fetchPendingReview, 5000);
    return () => clearInterval(interval);
  }, [hasProcessingDocs, hasActionableDocs, fetchPendingReview]);

  // Count active (non-confirmed, non-rejected) documents
  const activeCount = documents.filter(
    (d) => !confirmedIds.has(d.id) && !rejectedIds.has(d.id)
  ).length;

  function handleConfirmed(documentId: string) {
    setConfirmedIds((prev) => new Set(prev).add(documentId));
  }

  function handleRejected(documentId: string) {
    setRejectedIds((prev) => new Set(prev).add(documentId));
  }

  // Empty state — all processed
  if (documents.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Alle Belege verarbeitet
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Es gibt keine Belege zur Pruefung.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileSearch className="h-5 w-5 text-[var(--color-text-secondary)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          Belege zur Pruefung ({activeCount})
        </h2>
        {hasProcessingDocs && (
          <Loader2 className="h-4 w-4 text-sky-500 animate-spin" />
        )}
      </div>

      {/* Review Panels */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <DocumentReviewPanel
            key={doc.id}
            document={doc}
            onConfirmed={handleConfirmed}
            onRejected={handleRejected}
          />
        ))}
      </div>
    </div>
  );
}
