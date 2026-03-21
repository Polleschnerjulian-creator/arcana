"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Upload,
  FileText,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Building2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
  iban: string | null;
  account: { id: string; number: string; name: string };
}

interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  counterpartName: string | null;
  counterpartIban: string | null;
}

type ImportFormat =
  | "SPARKASSE"
  | "DKB"
  | "ING"
  | "COMMERZBANK"
  | "GENERIC"
  | "MT940";

interface ImportFormProps {
  bankAccounts: BankAccountOption[];
}

const FORMAT_OPTIONS: { value: ImportFormat; label: string; description: string }[] = [
  { value: "SPARKASSE", label: "Sparkasse", description: "CSV-Export der Sparkasse" },
  { value: "DKB", label: "DKB", description: "CSV-Export der DKB" },
  { value: "ING", label: "ING", description: "CSV-Export der ING" },
  { value: "COMMERZBANK", label: "Commerzbank", description: "CSV-Export der Commerzbank" },
  { value: "GENERIC", label: "Generisch", description: "Standard-CSV mit Datum, Betrag, Beschreibung" },
  { value: "MT940", label: "MT940", description: "SWIFT MT940 Bankformat (.sta, .mt940)" },
];

const ACCEPTED_EXTENSIONS = ".csv,.sta,.mt940,.txt";

// ─── Component ──────────────────────────────────────────────────

export function ImportForm({ bankAccounts }: ImportFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<ImportFormat | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<ParsedTransaction[] | null>(null);
  const [totalParsed, setTotalParsed] = useState<number>(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    count: number;
    autoConfirmed: number;
    autoSuggested: number;
    autoMatched: number;
    message: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Current step calculation
  const currentStep = !selectedAccountId
    ? 1
    : !selectedFormat
      ? 2
      : !file
        ? 3
        : !previewData && !importResult
          ? 3
          : !importResult
            ? 4
            : 5;

  // ─── File Handling ──────────────────────────────────────────

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setParseError(null);
      setPreviewData(null);
      setImportResult(null);
      setImportError(null);

      if (!selectedAccountId || !selectedFormat) return;

      // Parse preview
      setParsing(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("bankAccountId", selectedAccountId);
        formData.append("format", selectedFormat);
        formData.append("preview", "true");

        const res = await fetch("/api/bank/import", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!data.success) {
          setParseError(data.error || "Datei konnte nicht gelesen werden.");
          return;
        }

        setPreviewData(data.data?.preview || []);
        setTotalParsed(data.data?.totalCount || 0);
      } catch {
        setParseError("Fehler beim Parsen der Datei. Bitte prüfen Sie das Format.");
      } finally {
        setParsing(false);
      }
    },
    [selectedAccountId, selectedFormat]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  // ─── Import ─────────────────────────────────────────────────

  async function handleImport() {
    if (!file || !selectedAccountId || !selectedFormat) return;

    setImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankAccountId", selectedAccountId);
      formData.append("format", selectedFormat);

      const res = await fetch("/api/bank/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setImportError(data.error || "Import fehlgeschlagen.");
        return;
      }

      const importedCount = data.data?.imported || data.data?.importedCount || 0;
      const autoConfirmedCount = data.data?.autoConfirmed || 0;
      const autoSuggestedCount = data.data?.autoSuggested || 0;
      const autoMatchedCount = autoConfirmedCount + autoSuggestedCount;

      // Build detailed message
      const parts: string[] = [`${importedCount} Umsätze importiert`];
      if (autoConfirmedCount > 0) {
        parts.push(`${autoConfirmedCount} automatisch bestätigt`);
      }
      if (autoSuggestedCount > 0) {
        parts.push(`${autoSuggestedCount} Vorschläge zur Prüfung`);
      }
      const message = parts.join(", ") + ".";

      setImportResult({
        success: true,
        count: importedCount,
        autoConfirmed: autoConfirmedCount,
        autoSuggested: autoSuggestedCount,
        autoMatched: autoMatchedCount,
        message,
      });
    } catch {
      setImportError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setImporting(false);
    }
  }

  // ─── Reset ──────────────────────────────────────────────────

  function handleReset() {
    setFile(null);
    setPreviewData(null);
    setTotalParsed(0);
    setParseError(null);
    setImportResult(null);
    setImportError(null);
  }

  // ─── Render ─────────────────────────────────────────────────

  const selectedFormatOption = FORMAT_OPTIONS.find(
    (f) => f.value === selectedFormat
  );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                currentStep > step
                  ? "bg-primary text-white"
                  : currentStep === step
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-text-muted"
              )}
            >
              {currentStep > step ? (
                <Check className="h-4 w-4" />
              ) : (
                step
              )}
            </div>
            {step < 4 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-16 transition-colors",
                  currentStep > step ? "bg-primary" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Bank Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                currentStep >= 1
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-text-muted"
              )}
            >
              1
            </span>
            Bankkonto auswählen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-gray-50 p-4">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Kein Bankkonto vorhanden
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Erstellen Sie zuerst ein Bankkonto in den Einstellungen.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    // Re-parse if file already selected
                    if (file && selectedFormat) {
                      handleFile(file);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 text-left transition-all",
                    selectedAccountId === account.id
                      ? "border-primary bg-primary-50 ring-1 ring-primary"
                      : "border-border hover:border-border-hover hover:bg-gray-50"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {account.name}
                    </p>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">
                      {account.iban
                        ? account.iban.replace(/(.{4})/g, "$1 ").trim()
                        : "Keine IBAN"}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-text-muted">Konto</p>
                    <p className="text-xs font-mono text-text-secondary">
                      {account.account.number} {account.account.name}
                    </p>
                  </div>
                  {selectedAccountId === account.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Format */}
      {selectedAccountId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  currentStep >= 2
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-text-muted"
                )}
              >
                2
              </span>
              Format auswählen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map((format) => (
                <button
                  key={format.value}
                  onClick={() => {
                    setSelectedFormat(format.value);
                    if (file) {
                      handleFile(file);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-start rounded-lg border p-3 text-left transition-all",
                    selectedFormat === format.value
                      ? "border-primary bg-primary-50 ring-1 ring-primary"
                      : "border-border hover:border-border-hover hover:bg-gray-50"
                  )}
                >
                  <p className="text-sm font-medium text-text-primary">
                    {format.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {format.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: File Upload */}
      {selectedAccountId && selectedFormat && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  currentStep >= 3
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-text-muted"
                )}
              >
                3
              </span>
              Datei hochladen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {file ? (
              <div className="flex items-center gap-4 rounded-lg border border-border bg-gray-50 p-4">
                <FileText className="h-8 w-8 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {(file.size / 1024).toFixed(1)} KB &middot;{" "}
                    {selectedFormatOption?.label}
                  </p>
                </div>
                {!importResult && (
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-text-secondary hover:text-danger transition-colors rounded-md hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                  isDragging
                    ? "border-primary bg-gray-50/50"
                    : "border-border hover:border-primary/50 hover:bg-gray-50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFile(e.target.files[0]);
                    }
                    e.target.value = "";
                  }}
                />
                <Upload className="w-8 h-8 text-text-secondary mx-auto mb-3" />
                <p className="text-sm font-medium text-text-primary">
                  Datei hierher ziehen oder klicken
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  CSV, MT940, STA, TXT
                </p>
              </div>
            )}

            {/* Parse error */}
            {parseError && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-light border border-red-200 p-3 mt-4">
                <AlertCircle className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" />
                <p className="text-sm text-danger">{parseError}</p>
              </div>
            )}

            {/* Parsing indicator */}
            {parsing && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <p className="text-sm text-text-secondary">
                  Datei wird analysiert...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {previewData && !importResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">
                  4
                </span>
                Vorschau
              </CardTitle>
              <Badge variant="info">
                {totalParsed} Umsätze erkannt
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Betrag
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Beschreibung
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Gegenpartei
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.slice(0, 5).map((tx, index) => {
                    const isPositive = tx.amount >= 0;
                    return (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-sm text-text-primary whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-sm font-mono tabular-nums text-right whitespace-nowrap font-medium",
                            isPositive ? "text-success" : "text-danger"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-primary max-w-[250px] truncate">
                          {tx.description}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-secondary max-w-[180px] truncate">
                          {tx.counterpartName || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalParsed > 5 && (
              <p className="text-xs text-text-muted text-center mt-3">
                Zeige 5 von {totalParsed} Umsätzen
              </p>
            )}

            {/* Import error */}
            {importError && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-light border border-red-200 p-3 mt-4">
                <AlertCircle className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" />
                <p className="text-sm text-danger">{importError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-6">
              <Button variant="secondary" onClick={handleReset}>
                Abbrechen
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird importiert...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {totalParsed} Umsätze importieren
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Import Result */}
      {importResult && (
        <Card className="border-green-200">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light mb-4">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                Import abgeschlossen
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {importResult.message}
              </p>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    handleReset();
                    setSelectedAccountId("");
                    setSelectedFormat("");
                  }}
                >
                  Weiteren Import starten
                </Button>
                <Button onClick={() => router.push("/bank")}>
                  <ChevronRight className="h-4 w-4" />
                  Zur Bankübersicht
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
