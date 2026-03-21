"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus,
  X,
  AlertCircle,
  Loader2,
  Save,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface OrganizationData {
  name: string;
  legalForm: string;
  street: string | null;
  city: string | null;
  zip: string | null;
}

interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceFormProps {
  organization: OrganizationData;
}

// ─── Helpers ────────────────────────────────────────────────────

function generateKey(): string {
  return crypto.randomUUID();
}

function createEmptyLine(): LineItem {
  return {
    key: generateKey(),
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Component ──────────────────────────────────────────────────

export function InvoiceForm({ organization }: InvoiceFormProps) {
  const router = useRouter();

  // Customer fields
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Date fields
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 14));

  // Tax rate
  const [taxRate, setTaxRate] = useState<number>(19);

  // Line items
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Computed ───────────────────────────────────────────────

  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      return {
        key: line.key,
        total: qty * price,
      };
    });
  }, [lines]);

  const summary = useMemo(() => {
    const subtotal = lineCalculations.reduce((sum, l) => sum + l.total, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [lineCalculations, taxRate]);

  // ─── Line handlers ────────────────────────────────────────

  const updateLine = useCallback(
    (key: string, field: keyof Omit<LineItem, "key">, value: string) => {
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
      );
    },
    []
  );

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback(
    (key: string) => {
      if (lines.length <= 1) return;
      setLines((prev) => prev.filter((l) => l.key !== key));
    },
    [lines.length]
  );

  function getLineTotal(key: string): number {
    return lineCalculations.find((l) => l.key === key)?.total || 0;
  }

  // ─── Submit ─────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);

    // Validation
    if (!customerName.trim()) {
      setError("Bitte einen Kundennamen angeben.");
      return;
    }

    if (!issueDate) {
      setError("Bitte ein Rechnungsdatum angeben.");
      return;
    }

    if (!dueDate) {
      setError("Bitte ein Fälligkeitsdatum angeben.");
      return;
    }

    const hasEmptyDescription = lines.some((l) => !l.description.trim());
    if (hasEmptyDescription) {
      setError("Bitte für jede Position eine Beschreibung angeben.");
      return;
    }

    const hasInvalidPrice = lines.some(
      (l) => !l.unitPrice || parseFloat(l.unitPrice) <= 0
    );
    if (hasInvalidPrice) {
      setError("Bitte für jede Position einen gültigen Einzelpreis angeben.");
      return;
    }

    const hasInvalidQty = lines.some(
      (l) => !l.quantity || parseFloat(l.quantity) <= 0
    );
    if (hasInvalidQty) {
      setError("Bitte für jede Position eine gültige Menge angeben.");
      return;
    }

    if (summary.subtotal <= 0) {
      setError("Der Gesamtbetrag muss größer als 0 sein.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim() || null,
        issueDate,
        dueDate,
        taxRate,
        lineItems: lines.map((l) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice) || 0,
          total:
            (parseFloat(l.quantity) || 1) * (parseFloat(l.unitPrice) || 0),
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
        return;
      }

      router.push("/invoices");
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  const taxOptions = [
    { value: 19, label: "19%" },
    { value: 7, label: "7%" },
    { value: 0, label: "0% (Kleinunternehmer)" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* From (Organization info) */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader>
          <CardTitle>Absender</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-0.5">
            <p className="font-medium text-[var(--color-text)]">
              {organization.name}
            </p>
            {organization.street && <p>{organization.street}</p>}
            {(organization.zip || organization.city) && (
              <p>
                {organization.zip} {organization.city}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer section */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader>
          <CardTitle>Kunde</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Kundenname"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="z.B. Musterfirma GmbH"
              required
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Kundenadresse
              </label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Straße, PLZ Ort"
                rows={3}
                className={cn(
                  "flex w-full rounded-xl px-3.5 py-2.5 text-sm",
                  "bg-[var(--glass-bg)] backdrop-blur-xl",
                  "border border-[var(--glass-border)]",
                  "shadow-inner",
                  "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]",
                  "resize-none"
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates section */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader>
          <CardTitle>Datum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              type="date"
              label="Rechnungsdatum"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
            <Input
              type="date"
              label="Fälligkeitsdatum"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax rate selector */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader>
          <CardTitle>Steuersatz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {taxOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTaxRate(opt.value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                  taxRate === opt.value
                    ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-md"
                    : "bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)] text-[var(--color-text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--color-text)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Positionen</CardTitle>
          <Button size="sm" variant="secondary" onClick={addLine} type="button">
            <Plus className="h-3.5 w-3.5" />
            Zeile hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {/* Column headers (desktop) */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_120px_120px_36px] gap-3 mb-2 px-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Beschreibung
            </span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider text-right">
              Menge
            </span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider text-right">
              Einzelpreis
            </span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider text-right">
              Gesamt
            </span>
            <span />
          </div>

          {/* Lines */}
          <div className="space-y-3">
            {lines.map((line) => {
              const lineTotal = getLineTotal(line.key);

              return (
                <div key={line.key}>
                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_120px_120px_36px] gap-3 items-start">
                    {/* Description */}
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, "description", e.target.value)
                      }
                      placeholder="Beschreibung der Leistung"
                      className={cn(
                        "flex h-10 w-full rounded-xl px-3.5 py-2 text-sm",
                        "bg-[var(--glass-bg)] backdrop-blur-xl",
                        "border border-[var(--glass-border)]",
                        "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                        "transition-all duration-200 ease-out",
                        "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                      )}
                    />

                    {/* Quantity */}
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, "quantity", e.target.value)
                      }
                      className={cn(
                        "flex h-10 w-full rounded-xl px-3 py-2 text-sm text-right font-mono tabular-nums",
                        "bg-[var(--glass-bg)] backdrop-blur-xl",
                        "border border-[var(--glass-border)]",
                        "text-[var(--color-text)]",
                        "transition-all duration-200 ease-out",
                        "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                      )}
                    />

                    {/* Unit price */}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(line.key, "unitPrice", e.target.value)
                      }
                      placeholder="0,00"
                      className={cn(
                        "flex h-10 w-full rounded-xl px-3 py-2 text-sm text-right font-mono tabular-nums",
                        "bg-[var(--glass-bg)] backdrop-blur-xl",
                        "border border-[var(--glass-border)]",
                        "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                        "transition-all duration-200 ease-out",
                        "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                      )}
                    />

                    {/* Line total (read-only) */}
                    <div className="flex h-10 items-center justify-end px-3 text-sm font-mono tabular-nums text-[var(--color-text)]">
                      {formatCurrency(lineTotal)}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 1}
                      className={cn(
                        "flex h-10 w-9 items-center justify-center rounded-xl transition-colors",
                        lines.length > 1
                          ? "text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-500"
                          : "opacity-30 cursor-not-allowed text-[var(--color-text-tertiary)]"
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-2 p-3 rounded-xl bg-black/[0.02] border border-[var(--glass-border)]">
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.key, "description", e.target.value)
                        }
                        placeholder="Beschreibung"
                        className={cn(
                          "flex h-10 w-full rounded-xl px-3.5 py-2 text-sm",
                          "bg-[var(--glass-bg)] backdrop-blur-xl",
                          "border border-[var(--glass-border)]",
                          "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                          "transition-all duration-200 ease-out",
                          "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length <= 1}
                        className={cn(
                          "flex h-10 w-9 items-center justify-center rounded-xl flex-shrink-0 transition-colors",
                          lines.length > 1
                            ? "text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-500"
                            : "opacity-30 cursor-not-allowed text-[var(--color-text-tertiary)]"
                        )}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-tertiary)]">
                          Menge
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, "quantity", e.target.value)
                          }
                          className={cn(
                            "flex h-9 w-full rounded-lg px-2.5 py-1.5 text-sm text-right font-mono tabular-nums",
                            "bg-[var(--glass-bg)] border border-[var(--glass-border)]",
                            "text-[var(--color-text)]",
                            "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-tertiary)]">
                          Einzelpreis
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, "unitPrice", e.target.value)
                          }
                          placeholder="0,00"
                          className={cn(
                            "flex h-9 w-full rounded-lg px-2.5 py-1.5 text-sm text-right font-mono tabular-nums",
                            "bg-[var(--glass-bg)] border border-[var(--glass-border)]",
                            "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                            "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-tertiary)]">
                          Gesamt
                        </label>
                        <div className="flex h-9 items-center justify-end px-2.5 text-sm font-mono tabular-nums text-[var(--color-text)] font-medium">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="hover:shadow-none hover:translate-y-0">
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-xs ml-auto">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">
                Nettobetrag
              </span>
              <span className="font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(summary.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">
                MwSt ({taxRate}%)
              </span>
              <span className="font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(summary.tax)}
              </span>
            </div>
            <div className="border-t border-[var(--glass-border)] pt-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--color-text)]">
                  Bruttobetrag
                </span>
                <span className="text-lg font-semibold font-mono tabular-nums text-[var(--color-text)]">
                  {formatCurrency(summary.total)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-6">
        <Link
          href="/invoices"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
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
