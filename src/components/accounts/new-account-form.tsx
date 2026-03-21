"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NewAccountFormProps {
  onClose: () => void;
}

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type AccountCategory = "ANLAGE" | "UMLAUF" | "EIGENKAPITAL" | "ERLOES" | "AUFWAND";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "ASSET", label: "Aktiva" },
  { value: "LIABILITY", label: "Passiva" },
  { value: "EQUITY", label: "Eigenkapital" },
  { value: "REVENUE", label: "Erloese" },
  { value: "EXPENSE", label: "Aufwand" },
];

const CATEGORY_BY_TYPE: Record<AccountType, { value: AccountCategory; label: string }[]> = {
  ASSET: [
    { value: "ANLAGE", label: "Anlagevermögen" },
    { value: "UMLAUF", label: "Umlaufvermögen" },
  ],
  LIABILITY: [
    { value: "UMLAUF", label: "Umlaufvermögen" },
  ],
  EQUITY: [
    { value: "EIGENKAPITAL", label: "Eigenkapital" },
  ],
  REVENUE: [
    { value: "ERLOES", label: "Erlöse" },
  ],
  EXPENSE: [
    { value: "AUFWAND", label: "Aufwand" },
  ],
};

export function NewAccountForm({ onClose }: NewAccountFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType | "">("");
  const [category, setCategory] = useState<AccountCategory | "">("");

  // When type changes, reset category and auto-select if only one option
  function handleTypeChange(newType: AccountType) {
    setType(newType);
    const categories = CATEGORY_BY_TYPE[newType];
    if (categories.length === 1) {
      setCategory(categories[0].value);
    } else {
      setCategory("");
    }
    setFieldErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!number || number.length < 4 || !/^\d+$/.test(number)) {
      errors.number = "Bitte eine gültige Kontonummer eingeben (mind. 4 Ziffern).";
    }
    if (!name || name.length < 2) {
      errors.name = "Kontoname muss mindestens 2 Zeichen lang sein.";
    }
    if (!type) {
      errors.type = "Bitte einen Kontotyp wählen.";
    }
    if (!category) {
      errors.category = "Bitte eine Kategorie wählen.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, name, type, category }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const errs: Record<string, string> = {};
          for (const detail of data.details) {
            errs[detail.field] = detail.message;
          }
          setFieldErrors(errs);
        } else {
          setError(data.error || "Fehler beim Erstellen des Kontos.");
        }
        return;
      }

      // Success — close form and refresh page data
      onClose();
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableCategories = type ? CATEGORY_BY_TYPE[type] : [];

  return (
    <Card className="border-primary/30 bg-primary-50/30">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Neues Konto anlegen
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-danger-light px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Kontonummer */}
          <div>
            <Input
              label="Kontonummer"
              placeholder="z.B. 4300"
              value={number}
              onChange={(e) => {
                // Only allow digits, max 6 chars
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setNumber(val);
              }}
              error={fieldErrors.number}
              className="font-mono tabular-nums"
              maxLength={6}
            />
          </div>

          {/* Kontoname */}
          <div className="lg:col-span-2">
            <Input
              label="Kontoname"
              placeholder="z.B. Reisekosten"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
          </div>

          {/* Typ */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Typ
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Typ wählen...</option>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {fieldErrors.type && (
              <p className="text-sm text-danger">{fieldErrors.type}</p>
            )}
          </div>

          {/* Kategorie */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Kategorie
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AccountCategory)
              }
              disabled={!type}
              className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {type ? "Kategorie wählen..." : "Erst Typ wählen"}
              </option>
              {availableCategories.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {fieldErrors.category && (
              <p className="text-sm text-danger">{fieldErrors.category}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Speichern...
              </span>
            ) : (
              "Konto anlegen"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
