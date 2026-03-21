"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Calculator,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Info,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface OrganizationData {
  id: string;
  name: string;
  legalForm: string;
  taxId: string | null;
  ustId: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  chartOfAccounts: string;
  accountingMethod: string;
  fiscalYearStart: number;
}

interface SettingsFormProps {
  organization: OrganizationData;
  hasBookedTransactions: boolean;
}

// ─── Constants ──────────────────────────────────────────────────

const LEGAL_FORMS = [
  { value: "EU", label: "Einzelunternehmen" },
  { value: "GmbH", label: "GmbH" },
  { value: "UG", label: "UG (haftungsbeschraenkt)" },
  { value: "AG", label: "AG" },
  { value: "OHG", label: "OHG" },
  { value: "KG", label: "KG" },
  { value: "GbR", label: "GbR" },
  { value: "FreiBeruf", label: "Freiberufler" },
];

const MONTHS = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "Maerz" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Dezember" },
];

// ─── Feedback Component ─────────────────────────────────────────

function FeedbackMessage({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
        type === "success"
          ? "bg-success-light text-success"
          : "bg-danger-light text-danger"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function SettingsForm({
  organization,
  hasBookedTransactions,
}: SettingsFormProps) {
  // ── Company section state ──
  const [companyName, setCompanyName] = useState(organization.name);
  const [legalForm, setLegalForm] = useState(organization.legalForm);
  const [taxId, setTaxId] = useState(organization.taxId ?? "");
  const [ustId, setUstId] = useState(organization.ustId ?? "");
  const [street, setStreet] = useState(organization.street ?? "");
  const [zip, setZip] = useState(organization.zip ?? "");
  const [city, setCity] = useState(organization.city ?? "");
  const [companySaving, setCompanySaving] = useState(false);
  const [companyFeedback, setCompanyFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Accounting section state ──
  const [chartOfAccounts, setChartOfAccounts] = useState(
    organization.chartOfAccounts
  );
  const [accountingMethod, setAccountingMethod] = useState(
    organization.accountingMethod
  );
  const [fiscalYearStart, setFiscalYearStart] = useState(
    organization.fiscalYearStart
  );
  const [accountingSaving, setAccountingSaving] = useState(false);
  const [accountingFeedback, setAccountingFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);


  // ── Save Company ──
  async function handleSaveCompany() {
    setCompanySaving(true);
    setCompanyFeedback(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          legalForm,
          taxId: taxId || null,
          ustId: ustId || null,
          street: street || null,
          zip: zip || null,
          city: city || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCompanyFeedback({
          type: "error",
          message: data.error || "Fehler beim Speichern.",
        });
        return;
      }

      setCompanyFeedback({
        type: "success",
        message: "Unternehmensdaten wurden gespeichert.",
      });
    } catch {
      setCompanyFeedback({
        type: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setCompanySaving(false);
    }
  }

  // ── Save Accounting ──
  async function handleSaveAccounting() {
    setAccountingSaving(true);
    setAccountingFeedback(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartOfAccounts,
          accountingMethod,
          fiscalYearStart,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAccountingFeedback({
          type: "error",
          message: data.error || "Fehler beim Speichern.",
        });
        return;
      }

      setAccountingFeedback({
        type: "success",
        message: "Buchhaltungseinstellungen wurden gespeichert.",
      });
    } catch {
      setAccountingFeedback({
        type: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setAccountingSaving(false);
    }
  }


  return (
    <div className="space-y-6">
      {/* ── Section: Unternehmen ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Unternehmen</CardTitle>
              <CardDescription>
                Stammdaten und Adresse des Unternehmens
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Firmenname"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Rechtsform
              </label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                value={legalForm}
                onChange={(e) => setLegalForm(e.target.value)}
              >
                {LEGAL_FORMS.map((lf) => (
                  <option key={lf.value} value={lf.value}>
                    {lf.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Steuernummer"
              placeholder="z.B. 12/345/67890"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
            />
            <Input
              label="USt-IdNr."
              placeholder="z.B. DE123456789"
              value={ustId}
              onChange={(e) => setUstId(e.target.value)}
            />
          </div>

          <Input
            label="Strasse und Hausnummer"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="PLZ"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <Input
              label="Stadt"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {companyFeedback && (
            <FeedbackMessage
              type={companyFeedback.type}
              message={companyFeedback.message}
            />
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveCompany}
              disabled={companySaving || !companyName.trim()}
            >
              <Save className="h-4 w-4" />
              {companySaving ? "Speichert..." : "Unternehmen speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section: Buchhaltung ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-light">
              <Calculator className="h-4 w-4 text-info" />
            </div>
            <div>
              <CardTitle className="text-base">Buchhaltung</CardTitle>
              <CardDescription>
                Kontenrahmen, Abrechnungsmethode und Geschaeftsjahr
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kontenrahmen */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Kontenrahmen
            </label>
            <div className="flex items-center gap-3">
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                value={chartOfAccounts}
                onChange={(e) => setChartOfAccounts(e.target.value)}
                disabled={hasBookedTransactions}
              >
                <option value="SKR03">SKR03</option>
                <option value="SKR04">SKR04</option>
              </select>
              {hasBookedTransactions && (
                <Lock className="h-4 w-4 text-text-muted shrink-0" />
              )}
            </div>
            {hasBookedTransactions && (
              <div className="flex items-start gap-2 mt-1.5 text-xs text-text-muted">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Der Kontenrahmen kann nach der ersten gebuchten Transaktion
                  nicht mehr geaendert werden.
                </span>
              </div>
            )}
          </div>

          {/* Abrechnungsmethode */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Abrechnungsmethode
            </label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              value={accountingMethod}
              onChange={(e) => setAccountingMethod(e.target.value)}
            >
              <option value="EUR">
                Einnahmen-Ueberschuss-Rechnung (EUeR)
              </option>
              <option value="BILANZ">Bilanzierung</option>
            </select>
          </div>

          {/* Geschäftsjahresbeginn */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Geschaeftsjahresbeginn
            </label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {accountingFeedback && (
            <FeedbackMessage
              type={accountingFeedback.type}
              message={accountingFeedback.message}
            />
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveAccounting}
              disabled={accountingSaving}
            >
              <Save className="h-4 w-4" />
              {accountingSaving
                ? "Speichert..."
                : "Buchhaltung speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
