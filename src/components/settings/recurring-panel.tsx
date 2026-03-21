"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Loader2,
  Receipt,
  ArrowLeftRight,
  Calendar,
  Power,
  PowerOff,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceTemplateData {
  customerName: string;
  customerAddress?: string | null;
  taxRate: number;
  lineItems: InvoiceLineItem[];
}

interface TransactionLine {
  accountId: string;
  debit: number;
  credit: number;
}

interface TransactionTemplateData {
  description: string;
  reference?: string | null;
  lines: TransactionLine[];
}

interface RecurringTemplate {
  id: string;
  type: "INVOICE" | "TRANSACTION";
  name: string;
  interval: "MONTHLY" | "QUARTERLY" | "YEARLY";
  dayOfMonth: number;
  nextRunDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  templateData: InvoiceTemplateData | TransactionTemplateData;
  createdAt: string;
}

interface RecurringPanelProps {
  initialTemplates: RecurringTemplate[];
}

// ─── Labels ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; variant: "info" | "success" }> = {
  INVOICE: { label: "Rechnung", variant: "info" },
  TRANSACTION: { label: "Buchung", variant: "success" },
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Monatlich",
  QUARTERLY: "Quartalsweise",
  YEARLY: "Jaehrlich",
};

const TAX_RATES = [
  { value: 19, label: "19%" },
  { value: 7, label: "7%" },
  { value: 0, label: "0%" },
];

// ─── Component ──────────────────────────────────────────────────

export function RecurringPanel({ initialTemplates }: RecurringPanelProps) {
  const [templates, setTemplates] = useState<RecurringTemplate[]>(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<"INVOICE" | "TRANSACTION">("INVOICE");
  const [formName, setFormName] = useState("");
  const [formInterval, setFormInterval] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);

  // Invoice form state
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [taxRate, setTaxRate] = useState(19);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  // Transaction form state
  const [txDescription, setTxDescription] = useState("");
  const [txReference, setTxReference] = useState("");
  const [txLines, setTxLines] = useState<TransactionLine[]>([
    { accountId: "", debit: 0, credit: 0 },
    { accountId: "", debit: 0, credit: 0 },
  ]);

  // ─── Handlers ───────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormType("INVOICE");
    setFormName("");
    setFormInterval("MONTHLY");
    setFormDayOfMonth(1);
    setCustomerName("");
    setCustomerAddress("");
    setTaxRate(19);
    setLineItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    setTxDescription("");
    setTxReference("");
    setTxLines([
      { accountId: "", debit: 0, credit: 0 },
      { accountId: "", debit: 0, credit: 0 },
    ]);
    setError(null);
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const templateData =
        formType === "INVOICE"
          ? {
              customerName,
              customerAddress: customerAddress || null,
              taxRate,
              lineItems,
            }
          : {
              description: txDescription,
              reference: txReference || null,
              lines: txLines,
            };

      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          name: formName,
          interval: formInterval,
          dayOfMonth: formDayOfMonth,
          templateData,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Fehler beim Erstellen.");
        return;
      }

      setTemplates((prev) => [json.data, ...prev]);
      resetForm();
      setShowForm(false);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isActive: !currentActive } : t))
        );
      }
    } catch {
      // Silent fail for toggle
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // Silent fail
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Line Item Helpers ──────────────────────────────────────

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addTxLine = () => {
    setTxLines((prev) => [...prev, { accountId: "", debit: 0, credit: 0 }]);
  };

  const removeTxLine = (index: number) => {
    if (txLines.length <= 2) return;
    setTxLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTxLine = (index: number, field: keyof TransactionLine, value: string | number) => {
    setTxLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {templates.length === 0
            ? "Noch keine Vorlagen vorhanden."
            : `${templates.length} Vorlage${templates.length !== 1 ? "n" : ""}`}
        </p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Neue Vorlage
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Neue Vorlage erstellen</CardTitle>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-black/[0.04] transition-all"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Typ
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("INVOICE")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all border",
                      formType === "INVOICE"
                        ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                        : "bg-[var(--glass-bg)] text-[var(--color-text-secondary)] border-[var(--glass-border)] hover:bg-[var(--glass-bg-hover)]"
                    )}
                  >
                    <Receipt className="h-4 w-4" />
                    Rechnung
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("TRANSACTION")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all border",
                      formType === "TRANSACTION"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-[var(--glass-bg)] text-[var(--color-text-secondary)] border-[var(--glass-border)] hover:bg-[var(--glass-bg-hover)]"
                    )}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Buchung
                  </button>
                </div>
              </div>

              {/* Name */}
              <Input
                label="Name der Vorlage"
                placeholder="z.B. Monatliche Bueromiete"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />

              {/* Interval + Day */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    Intervall
                  </label>
                  <select
                    value={formInterval}
                    onChange={(e) =>
                      setFormInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "YEARLY")
                    }
                    className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                  >
                    <option value="MONTHLY">Monatlich</option>
                    <option value="QUARTERLY">Quartalsweise</option>
                    <option value="YEARLY">Jaehrlich</option>
                  </select>
                </div>
                <Input
                  label="Tag im Monat"
                  type="number"
                  min={1}
                  max={28}
                  value={formDayOfMonth}
                  onChange={(e) => setFormDayOfMonth(parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Type-specific fields */}
              {formType === "INVOICE" ? (
                <div className="space-y-4 pt-2 border-t border-[var(--glass-border)]">
                  <h4 className="text-sm font-medium text-[var(--color-text)]">
                    Rechnungsdetails
                  </h4>
                  <Input
                    label="Kundenname"
                    placeholder="Mustermann GmbH"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    label="Kundenadresse (optional)"
                    placeholder="Musterstr. 1, 12345 Berlin"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Steuersatz
                    </label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseInt(e.target.value))}
                      className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                    >
                      {TAX_RATES.map((rate) => (
                        <option key={rate.value} value={rate.value}>
                          {rate.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Positionen
                    </label>
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            placeholder="Beschreibung"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, "description", e.target.value)}
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            placeholder="Menge"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)
                            }
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            placeholder="Preis"
                            min={0}
                            step={0.01}
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                            }
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-500/[0.08] transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addLineItem}>
                      <Plus className="h-3.5 w-3.5" />
                      Position hinzufuegen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-[var(--glass-border)]">
                  <h4 className="text-sm font-medium text-[var(--color-text)]">
                    Buchungsdetails
                  </h4>
                  <Input
                    label="Beschreibung"
                    placeholder="Bueromiete"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                  />
                  <Input
                    label="Referenz (optional)"
                    placeholder="Vertrag Nr. 123"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                  />

                  {/* Transaction Lines */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Buchungszeilen (Soll / Haben)
                    </label>
                    {txLines.map((line, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            placeholder="Konto-ID"
                            value={line.accountId}
                            onChange={(e) => updateTxLine(index, "accountId", e.target.value)}
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            placeholder="Soll"
                            min={0}
                            step={0.01}
                            value={line.debit}
                            onChange={(e) =>
                              updateTxLine(index, "debit", parseFloat(e.target.value) || 0)
                            }
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            placeholder="Haben"
                            min={0}
                            step={0.01}
                            value={line.credit}
                            onChange={(e) =>
                              updateTxLine(index, "credit", parseFloat(e.target.value) || 0)
                            }
                            className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                          />
                        </div>
                        {txLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeTxLine(index)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-500/[0.08] transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addTxLine}>
                      <Plus className="h-3.5 w-3.5" />
                      Zeile hinzufuegen
                    </Button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/15 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleCreate} disabled={loading || !formName.trim()}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Vorlage erstellen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template List */}
      {templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((template) => {
            const typeConfig = TYPE_LABELS[template.type];

            return (
              <Card
                key={template.id}
                className={cn(
                  "transition-opacity",
                  !template.isActive && "opacity-50"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {template.name}
                        </h3>
                        <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                        <Badge>{INTERVAL_LABELS[template.interval]}</Badge>
                        {!template.isActive && (
                          <Badge variant="warning">Inaktiv</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Tag {template.dayOfMonth}
                        </span>
                        <span>
                          Naechste Ausfuehrung:{" "}
                          {formatDate(template.nextRunDate)}
                        </span>
                        {template.lastRunDate && (
                          <span>
                            Zuletzt: {formatDate(template.lastRunDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(template.id, template.isActive)}
                        disabled={togglingId === template.id}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                          template.isActive
                            ? "text-emerald-600 hover:bg-emerald-500/10"
                            : "text-[var(--color-text-tertiary)] hover:bg-black/[0.04]"
                        )}
                        title={template.isActive ? "Deaktivieren" : "Aktivieren"}
                      >
                        {togglingId === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : template.isActive ? (
                          <Power className="h-4 w-4" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-500/[0.08] transition-all"
                        title="Loeschen"
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {templates.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04]">
                <Calendar className="h-6 w-6 text-[var(--color-text-tertiary)]" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-1">
              Keine Vorlagen
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Erstellen Sie wiederkehrende Rechnungen oder Buchungen, die automatisch ausgefuehrt werden.
            </p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Erste Vorlage erstellen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
