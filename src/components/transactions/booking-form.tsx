"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Save,
  FileDown,
  ChevronDown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface AccountOption {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface BookingLine {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
}

interface BookingFormProps {
  accounts: AccountOption[];
}

// ─── Helper ─────────────────────────────────────────────────────

function generateKey(): string {
  return crypto.randomUUID();
}

function createEmptyLine(): BookingLine {
  return {
    key: generateKey(),
    accountId: "",
    debit: "",
    credit: "",
  };
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Component ──────────────────────────────────────────────────

// ─── Template Types ─────────────────────────────────────────────

interface TemplateLine {
  accountNumber: string;
  debit: boolean;
  credit: boolean;
  taxRate?: number | null;
}

interface BookingTemplate {
  id: string;
  name: string;
  description: string | null;
  templateLines: string; // JSON
  isDefault: boolean;
}

export function BookingForm({ accounts }: BookingFormProps) {
  const router = useRouter();

  // Header fields
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  // Lines
  const [lines, setLines] = useState<BookingLine[]>([
    createEmptyLine(),
    createEmptyLine(),
  ]);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account search filter per line
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // ─── Templates ────────────────────────────────────────────────

  const [templates, setTemplates] = useState<BookingTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data);
        }
      } catch {
        // Silently fail — templates are optional
      } finally {
        setTemplatesLoaded(true);
      }
    }
    loadTemplates();
  }, []);

  function applyTemplate(template: BookingTemplate) {
    try {
      const templateLines: TemplateLine[] = JSON.parse(template.templateLines);
      const newLines: BookingLine[] = templateLines.map((tl) => {
        // Find the account by number
        const account = accounts.find((a) => a.number === tl.accountNumber);
        return {
          key: generateKey(),
          accountId: account?.id || "",
          debit: tl.debit ? "" : "",
          credit: tl.credit ? "" : "",
        };
      });

      // Ensure at least 2 lines
      while (newLines.length < 2) {
        newLines.push(createEmptyLine());
      }

      setLines(newLines);
      setDescription(template.name);
      setShowTemplates(false);
      setSearchTerms({});
    } catch {
      // Ignore parse errors
    }
  }

  // ─── Computed ───────────────────────────────────────────────

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => {
      const v = parseFloat(l.debit);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const totalCredit = lines.reduce((sum, l) => {
      const v = parseFloat(l.credit);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const diff = Math.abs(totalDebit - totalCredit);
    const balanced = totalDebit > 0 && totalCredit > 0 && diff < 0.005;
    return { totalDebit, totalCredit, diff, balanced };
  }, [lines]);

  // ─── Line handlers ─────────────────────────────────────────

  const updateLine = useCallback(
    (key: string, field: keyof BookingLine, value: string) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.key !== key) return l;

          // If user enters Soll, clear Haben (and vice versa)
          if (field === "debit" && value !== "") {
            return { ...l, debit: value, credit: "" };
          }
          if (field === "credit" && value !== "") {
            return { ...l, credit: value, debit: "" };
          }
          return { ...l, [field]: value };
        })
      );
    },
    []
  );

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback(
    (key: string) => {
      if (lines.length <= 2) return;
      setLines((prev) => prev.filter((l) => l.key !== key));
    },
    [lines.length]
  );

  // ─── Account search/select ─────────────────────────────────

  const getFilteredAccounts = useCallback(
    (lineKey: string) => {
      const term = (searchTerms[lineKey] || "").toLowerCase();
      if (!term) return accounts;
      return accounts.filter(
        (a) =>
          a.number.includes(term) || a.name.toLowerCase().includes(term)
      );
    },
    [accounts, searchTerms]
  );

  const selectAccount = useCallback(
    (lineKey: string, accountId: string) => {
      setLines((prev) =>
        prev.map((l) => (l.key === lineKey ? { ...l, accountId } : l))
      );
      setOpenDropdown(null);
      setSearchTerms((prev) => ({ ...prev, [lineKey]: "" }));
    },
    []
  );

  const getAccountLabel = useCallback(
    (accountId: string) => {
      const acc = accounts.find((a) => a.id === accountId);
      return acc ? `${acc.number} — ${acc.name}` : "";
    },
    [accounts]
  );

  // ─── Submit ─────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);

    // Basic validation
    if (!date) {
      setError("Bitte ein Buchungsdatum angeben.");
      return;
    }
    if (!description.trim()) {
      setError("Bitte eine Beschreibung angeben.");
      return;
    }

    const hasEmptyAccount = lines.some((l) => !l.accountId);
    if (hasEmptyAccount) {
      setError("Bitte für jede Zeile ein Konto auswählen.");
      return;
    }

    const hasEmptyAmount = lines.some(
      (l) => !l.debit && !l.credit
    );
    if (hasEmptyAmount) {
      setError("Bitte für jede Zeile einen Betrag eingeben.");
      return;
    }

    if (!totals.balanced) {
      setError(
        "Die Buchung ist nicht ausgeglichen. Soll und Haben müssen übereinstimmen."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        date,
        description: description.trim(),
        reference: reference.trim() || null,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
        return;
      }

      router.push("/transactions");
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Template selector */}
      {templatesLoaded && templates.length > 0 && (
        <div className="relative">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowTemplates(!showTemplates)}
            type="button"
          >
            <FileDown className="h-3.5 w-3.5" />
            Vorlage laden
            <ChevronDown className={cn(
              "h-3.5 w-3.5 transition-transform",
              showTemplates && "rotate-180"
            )} />
          </Button>

          {showTemplates && (
            <div className="absolute z-50 top-full left-0 mt-1 w-80 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-[var(--glass-border)]">
                <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider px-2 py-1">
                  Buchungsvorlagen
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                          {t.description}
                        </p>
                      )}
                    </div>
                    {t.isDefault && (
                      <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] bg-black/[0.04] dark:bg-white/[0.04] px-1.5 py-0.5 rounded">
                        Standard
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>Buchungsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              type="date"
              label="Datum"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Büromiete März 2026"
              required
            />
            <Input
              label="Belegnummer"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Buchungszeilen</CardTitle>
          <Button size="sm" variant="secondary" onClick={addLine} type="button">
            <Plus className="h-3.5 w-3.5" />
            Zeile hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_140px_140px_36px] gap-3 mb-2 px-1">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Konto
            </span>
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider text-right">
              Soll
            </span>
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider text-right">
              Haben
            </span>
            <span />
          </div>

          {/* Lines */}
          <div className="space-y-2">
            {lines.map((line) => {
              const isDropdownOpen = openDropdown === line.key;
              const filtered = getFilteredAccounts(line.key);
              const hasDebit = line.debit !== "";
              const hasCredit = line.credit !== "";

              return (
                <div
                  key={line.key}
                  className="grid grid-cols-[1fr_140px_140px_36px] gap-3 items-start"
                >
                  {/* Account selector */}
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        isDropdownOpen
                          ? searchTerms[line.key] || ""
                          : getAccountLabel(line.accountId)
                      }
                      onChange={(e) => {
                        setSearchTerms((prev) => ({
                          ...prev,
                          [line.key]: e.target.value,
                        }));
                        setOpenDropdown(line.key);
                      }}
                      onFocus={() => setOpenDropdown(line.key)}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => {
                          if (openDropdown === line.key) {
                            setOpenDropdown(null);
                          }
                        }, 200);
                      }}
                      placeholder="Konto suchen..."
                      className={cn(
                        "flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                      )}
                    />
                    {isDropdownOpen && filtered.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                        {filtered.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectAccount(line.key, acc.id)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50",
                              acc.id === line.accountId && "bg-primary/5 text-primary"
                            )}
                          >
                            <span className="font-mono text-text-secondary text-xs">
                              {acc.number}
                            </span>
                            <span className="text-text-primary">
                              {acc.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {isDropdownOpen && filtered.length === 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-surface shadow-lg px-3 py-3 text-sm text-text-muted">
                        Kein Konto gefunden
                      </div>
                    )}
                  </div>

                  {/* Soll (Debit) */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={line.debit}
                    onChange={(e) =>
                      updateLine(line.key, "debit", e.target.value)
                    }
                    disabled={hasCredit}
                    className={cn(
                      "flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-right font-mono tabular-nums transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
                      hasDebit && "text-red-600"
                    )}
                  />

                  {/* Haben (Credit) */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={line.credit}
                    onChange={(e) =>
                      updateLine(line.key, "credit", e.target.value)
                    }
                    disabled={hasDebit}
                    className={cn(
                      "flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-right font-mono tabular-nums transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
                      hasCredit && "text-green-600"
                    )}
                  />

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 2}
                    className={cn(
                      "flex h-10 w-9 items-center justify-center rounded-lg text-text-muted transition-colors",
                      lines.length > 2
                        ? "hover:bg-red-50 hover:text-red-500"
                        : "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Validation summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="text-text-secondary">Summe Soll: </span>
                <span className="font-mono tabular-nums font-semibold text-red-600">
                  {formatCurrency(totals.totalDebit)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-text-secondary">Summe Haben: </span>
                <span className="font-mono tabular-nums font-semibold text-green-600">
                  {formatCurrency(totals.totalCredit)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {totals.balanced ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <Check className="h-4 w-4" />
                  Ausgeglichen
                </div>
              ) : (totals.totalDebit > 0 || totals.totalCredit > 0) ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Differenz: {formatCurrency(totals.diff)}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <Link
          href="/transactions"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Abbrechen
        </Link>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="md"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Als Entwurf speichern
        </Button>
      </div>
    </div>
  );
}
