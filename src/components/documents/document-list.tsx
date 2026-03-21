"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  FileText,
  Image,
  File,
  Trash2,
  Eye,
  Download,
  LayoutGrid,
  List,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface DocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  type:
    | "INCOMING_INVOICE"
    | "OUTGOING_INVOICE"
    | "RECEIPT"
    | "BANK_STATEMENT"
    | "OTHER";
  ocrStatus: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  aiExtraction: string | null;
  sha256Hash: string;
  uploadedAt: string;
  uploadedBy: { id: string; name: string };
}

interface DocumentListProps {
  documents: DocumentItem[];
}

// ─── Helpers ────────────────────────────────────────────────────

const TYPE_LABELS: Record<DocumentItem["type"], string> = {
  INCOMING_INVOICE: "Eingangsrechnung",
  OUTGOING_INVOICE: "Ausgangsrechnung",
  RECEIPT: "Quittung",
  BANK_STATEMENT: "Kontoauszug",
  OTHER: "Sonstiges",
};

const TYPE_VARIANTS: Record<
  DocumentItem["type"],
  "default" | "success" | "warning" | "danger" | "info"
> = {
  INCOMING_INVOICE: "info",
  OUTGOING_INVOICE: "success",
  RECEIPT: "warning",
  BANK_STATEMENT: "default",
  OTHER: "default",
};

function getOcrLabel(doc: DocumentItem): string {
  if (doc.ocrStatus === "PENDING") return "Wird verarbeitet...";
  if (doc.ocrStatus === "PROCESSING") return "Text wird erkannt...";
  if (doc.ocrStatus === "DONE" && doc.aiExtraction) return "Verarbeitet";
  if (doc.ocrStatus === "DONE") return "Text erkannt";
  if (doc.ocrStatus === "FAILED") return "Fehler";
  return doc.ocrStatus;
}

function getOcrVariant(
  doc: DocumentItem
): "default" | "success" | "warning" | "danger" | "info" {
  if (doc.ocrStatus === "PENDING") return "warning";
  if (doc.ocrStatus === "PROCESSING") return "info";
  if (doc.ocrStatus === "DONE" && doc.aiExtraction) return "success";
  if (doc.ocrStatus === "DONE") return "info";
  if (doc.ocrStatus === "FAILED") return "danger";
  return "default";
}

function isOcrInProgress(doc: DocumentItem): boolean {
  return doc.ocrStatus === "PENDING" || doc.ocrStatus === "PROCESSING";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (mimeType.startsWith("image/")) {
    return <Image aria-hidden className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

// ─── Component ──────────────────────────────────────────────────

export function DocumentList({ documents }: DocumentListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentItem["type"] | "ALL">(
    "ALL"
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState(documents);

  // Filter documents
  const filtered = items.filter((doc) => {
    const matchesSearch = doc.fileName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Delete handler
  async function handleDelete(id: string) {
    if (!confirm("Beleg wirklich löschen?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setItems((prev) => prev.filter((d) => d.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        alert(data.error || "Fehler beim Löschen.");
      }
    } catch {
      alert("Fehler beim Löschen.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Beleg suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as DocumentItem["type"] | "ALL")
          }
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        >
          <option value="ALL">Alle Typen</option>
          <option value="INCOMING_INVOICE">Eingangsrechnung</option>
          <option value="OUTGOING_INVOICE">Ausgangsrechnung</option>
          <option value="RECEIPT">Quittung</option>
          <option value="BANK_STATEMENT">Kontoauszug</option>
          <option value="OTHER">Sonstiges</option>
        </select>

        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`h-10 px-3 flex items-center justify-center transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary hover:bg-gray-50"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`h-10 px-3 flex items-center justify-center transition-colors ${
              viewMode === "list"
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary hover:bg-gray-50"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-text-secondary">
        {filtered.length} {filtered.length === 1 ? "Beleg" : "Belege"}{" "}
        {typeFilter !== "ALL" && `(${TYPE_LABELS[typeFilter]})`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary font-medium">
              Keine Belege gefunden
            </p>
            <p className="text-sm text-text-muted mt-1">
              {searchQuery || typeFilter !== "ALL"
                ? "Versuchen Sie, Ihre Filter anzupassen."
                : "Laden Sie Ihren ersten Beleg hoch."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <Card
              key={doc.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getFileIcon(doc.mimeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {doc.fileName}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatFileSize(doc.fileSize)} &middot;{" "}
                      {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={TYPE_VARIANTS[doc.type]}>
                    {TYPE_LABELS[doc.type]}
                  </Badge>
                  <Badge variant={getOcrVariant(doc)}>
                    {isOcrInProgress(doc) && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {getOcrLabel(doc)}
                  </Badge>
                  {doc.aiExtraction && (
                    <Badge variant="success">
                      <Sparkles className="h-3 w-3 mr-1" />
                      KI
                    </Badge>
                  )}
                </div>

                {/* Expand / Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === doc.id ? null : doc.id)
                    }
                    className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
                  >
                    {expandedId === doc.id ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Weniger
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Details
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
                      title="Anzeigen"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <a
                      href={`/api/documents/${doc.id}/file`}
                      download
                      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="p-1.5 rounded-md text-text-secondary hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === doc.id && (
                  <div className="pt-2 border-t border-border space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Hochgeladen von</span>
                      <span className="text-text-primary">
                        {doc.uploadedBy.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">MIME-Typ</span>
                      <span className="text-text-primary font-mono">
                        {doc.mimeType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">SHA-256</span>
                      <span
                        className="text-text-primary font-mono truncate max-w-[160px]"
                        title={doc.sha256Hash}
                      >
                        {doc.sha256Hash.slice(0, 16)}...
                      </span>
                    </div>
                    {doc.aiExtraction && (
                      <div className="pt-1">
                        <span className="text-text-muted block mb-1">
                          KI-Extraktion
                        </span>
                        <pre className="bg-gray-50 rounded-md p-2 text-text-primary overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(
                            JSON.parse(doc.aiExtraction),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-text-secondary">
                    Datei
                  </th>
                  <th className="text-left p-3 font-medium text-text-secondary hidden sm:table-cell">
                    Typ
                  </th>
                  <th className="text-left p-3 font-medium text-text-secondary hidden md:table-cell">
                    Größe
                  </th>
                  <th className="text-left p-3 font-medium text-text-secondary hidden md:table-cell">
                    Datum
                  </th>
                  <th className="text-left p-3 font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="text-right p-3 font-medium text-text-secondary">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.mimeType)}
                        <span className="font-medium text-text-primary truncate max-w-[200px]">
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant={TYPE_VARIANTS[doc.type]}>
                        {TYPE_LABELS[doc.type]}
                      </Badge>
                    </td>
                    <td className="p-3 text-text-secondary hidden md:table-cell">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="p-3 text-text-secondary hidden md:table-cell">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={getOcrVariant(doc)}>
                          {isOcrInProgress(doc) && (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          )}
                          {getOcrLabel(doc)}
                        </Badge>
                        {doc.aiExtraction && (
                          <Badge variant="success">
                            <Sparkles className="h-3 w-3 mr-1" />
                            KI
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
                          title="Anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        <a
                          href={`/api/documents/${doc.id}/file`}
                          download
                          className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
                          title="Herunterladen"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="p-1.5 rounded-md text-text-secondary hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
