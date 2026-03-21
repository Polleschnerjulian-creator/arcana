"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Palette,
  CreditCard,
  FileText,
  Eye,
  Type,
  ToggleLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

interface InvoiceSettings {
  logoUrl?: string;
  accentColor?: string;
  bankName?: string;
  bankIban?: string;
  bankBic?: string;
  paymentTermsDays?: number;
  paymentTermsText?: string;
  footerText?: string;
  showUstId?: boolean;
  showTaxId?: boolean;
}

interface OrgInfo {
  name: string;
  street: string | null;
  city: string | null;
  zip: string | null;
  ustId: string | null;
  taxId: string | null;
}

interface InvoiceDesignPanelProps {
  organization: OrgInfo;
  initialSettings: InvoiceSettings;
}

// ─── Constants ──────────────────────────────────────────────────

const COLOR_PRESETS = [
  { name: "Schwarz", value: "#1D1D1F" },
  { name: "Dunkelblau", value: "#1B3A5C" },
  { name: "Dunkelgruen", value: "#2D5A3D" },
  { name: "Bordeaux", value: "#6B2C3E" },
];

// ─── IBAN Formatter ─────────────────────────────────────────────

function formatIban(value: string): string {
  // Remove all non-alphanumeric characters
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  // Insert space every 4 characters
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function unformatIban(value: string): string {
  return value.replace(/\s/g, "");
}

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

// ─── Live Preview HTML Generator ────────────────────────────────

function generatePreviewHTML(org: OrgInfo, settings: InvoiceSettings): string {
  const accent = settings.accentColor || "#1D1D1F";
  const orgName = org.name || "Muster GmbH";
  const orgStreet = org.street || "Musterstrasse 1";
  const orgCity =
    org.zip && org.city
      ? `${org.zip} ${org.city}`
      : org.city || "10115 Berlin";

  const showUstId = settings.showUstId !== false;
  const showTaxId = settings.showTaxId !== false;

  const logoHtml = settings.logoUrl
    ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 160px; object-fit: contain;" />`
    : "";

  const bankHtml =
    settings.bankName || settings.bankIban
      ? `
    <div style="margin-top: 16px;">
      <div style="font-weight: 600; font-size: 10px; color: #374151; margin-bottom: 4px;">Bankverbindung</div>
      <div style="font-size: 9px; color: #6b7280; line-height: 1.6;">
        Kontoinhaber: ${escapePreview(orgName)}<br>
        ${settings.bankName ? `Bank: ${escapePreview(settings.bankName)}<br>` : ""}
        ${settings.bankIban ? `IBAN: ${escapePreview(settings.bankIban)}<br>` : ""}
        ${settings.bankBic ? `BIC: ${escapePreview(settings.bankBic)}` : ""}
      </div>
    </div>`
      : `
    <div style="margin-top: 16px;">
      <div style="font-weight: 600; font-size: 10px; color: #374151; margin-bottom: 4px;">Bankverbindung</div>
      <div style="font-size: 9px; color: #6b7280; line-height: 1.6;">
        Kontoinhaber: ${escapePreview(orgName)}<br>
        IBAN: DE00 0000 0000 0000 0000 00<br>
        BIC: XXXXXXXXXXX<br>
        Bank: Musterbank
      </div>
    </div>`;

  const paymentText =
    settings.paymentTermsText ||
    `Zahlbar innerhalb von ${settings.paymentTermsDays || 14} Tagen ohne Abzug.`;

  const footerText = settings.footerText || "";

  const taxInfoParts: string[] = [];
  if (showUstId && org.ustId) {
    taxInfoParts.push(`USt-IdNr.: ${escapePreview(org.ustId)}`);
  }
  if (showTaxId && org.taxId) {
    taxInfoParts.push(`Steuernummer: ${escapePreview(org.taxId)}`);
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Helvetica, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
      padding: 24px 28px;
    }
  </style>
</head>
<body>
  <!-- Accent bar -->
  <div style="height: 3px; background: ${accent}; margin-bottom: 20px; border-radius: 2px;"></div>

  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
    <div>
      ${logoHtml ? `<div style="margin-bottom: 8px;">${logoHtml}</div>` : ""}
      <div style="font-size: 14px; font-weight: 700; color: #111827;">${escapePreview(orgName)}</div>
      <div style="font-size: 9px; color: #6b7280; margin-top: 2px;">${escapePreview(orgStreet)}</div>
      <div style="font-size: 9px; color: #6b7280;">${escapePreview(orgCity)}</div>
      ${taxInfoParts.length > 0 ? `<div style="font-size: 9px; color: #6b7280; margin-top: 2px;">${taxInfoParts.join(" · ")}</div>` : ""}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 800; color: ${accent}; letter-spacing: -0.5px;">RECHNUNG</div>
      <div style="font-size: 9px; color: #6b7280; margin-top: 2px;">Nr. RE-2026-0001</div>
    </div>
  </div>

  <!-- Customer -->
  <div style="font-size: 7px; color: #9ca3af; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; margin-bottom: 2px; max-width: 200px;">
    ${escapePreview(orgName)} · ${escapePreview(orgStreet)} · ${escapePreview(orgCity)}
  </div>
  <div style="margin-bottom: 16px;">
    <div style="font-weight: 600; font-size: 10px;">Musterkunde GmbH</div>
    <div style="font-size: 9px; color: #4b5563;">Beispielweg 42<br>80331 Muenchen</div>
  </div>

  <!-- Dates -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 9px; color: #4b5563;">
    <div><span style="color: #9ca3af;">Rechnungsdatum:</span> 21.03.2026</div>
    <div><span style="color: #9ca3af;">Faellig am:</span> ${(() => {
      const d = new Date();
      d.setDate(d.getDate() + (settings.paymentTermsDays || 14));
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    })()}</div>
  </div>

  <!-- Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
    <thead>
      <tr style="background: #f9fafb;">
        <th style="padding: 4px 6px; text-align: left; font-size: 8px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid ${accent}20; font-weight: 600;">Pos.</th>
        <th style="padding: 4px 6px; text-align: left; font-size: 8px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid ${accent}20; font-weight: 600;">Beschreibung</th>
        <th style="padding: 4px 6px; text-align: right; font-size: 8px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid ${accent}20; font-weight: 600;">Menge</th>
        <th style="padding: 4px 6px; text-align: right; font-size: 8px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid ${accent}20; font-weight: 600;">Einzelpreis</th>
        <th style="padding: 4px 6px; text-align: right; font-size: 8px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid ${accent}20; font-weight: 600;">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; color: #6b7280;">1</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px;">Beratungsleistung</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right;">10</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right;">150,00 &euro;</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right; font-weight: 500;">1.500,00 &euro;</td>
      </tr>
      <tr>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; color: #6b7280;">2</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px;">Projektmanagement</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right;">5</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right;">120,00 &euro;</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-align: right; font-weight: 500;">600,00 &euro;</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
    <div style="width: 180px;">
      <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 9px; color: #4b5563;">
        <span>Nettobetrag</span>
        <span>2.100,00 &euro;</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 9px; color: #4b5563; border-bottom: 1px solid #e5e7eb;">
        <span>MwSt. 19%</span>
        <span>399,00 &euro;</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; font-weight: 700; color: ${accent};">
        <span>Bruttobetrag</span>
        <span>2.499,00 &euro;</span>
      </div>
    </div>
  </div>

  <!-- Payment Terms -->
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; margin-bottom: 12px;">
    <div style="font-weight: 600; font-size: 9px; color: #374151; margin-bottom: 2px;">Zahlungsbedingungen</div>
    <div style="font-size: 9px; color: #4b5563;">${escapePreview(paymentText)}</div>
  </div>

  <!-- Bank Details -->
  ${bankHtml}

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 16px; font-size: 8px; color: #9ca3af; text-align: center;">
    ${footerText ? `<div style="margin-bottom: 4px;">${escapePreview(footerText)}</div>` : ""}
    ${escapePreview(orgName)}${org.street ? ` &middot; ${escapePreview(org.street)}` : ""}${orgCity ? ` &middot; ${escapePreview(orgCity)}` : ""}
    ${taxInfoParts.length > 0 ? `<br>${taxInfoParts.join(" &middot; ")}` : ""}
  </div>
</body>
</html>`;
}

function escapePreview(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Main Component ─────────────────────────────────────────────

export function InvoiceDesignPanel({
  organization,
  initialSettings,
}: InvoiceDesignPanelProps) {
  // ── State ──
  const [settings, setSettings] = useState<InvoiceSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Update setting helper ──
  const updateSetting = useCallback(
    <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ── IBAN handler ──
  const handleIbanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = unformatIban(e.target.value);
      // Max 34 chars for IBAN
      if (raw.length <= 34) {
        updateSetting("bankIban", formatIban(raw));
      }
    },
    [updateSetting]
  );

  // ── Live preview update ──
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const html = generatePreviewHTML(organization, settings);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [settings, organization]);

  // ── Logo upload ──
  const handleLogoUpload = useCallback(
    async (file: File) => {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        setFeedback({
          type: "error",
          message: "Ungueltiges Format. Erlaubt: JPG, PNG, WebP, SVG.",
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setFeedback({
          type: "error",
          message: "Datei zu gross. Maximale Groesse: 2 MB.",
        });
        return;
      }

      setUploading(true);
      setFeedback(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/settings/invoice/logo", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setFeedback({
            type: "error",
            message: data.error || "Fehler beim Hochladen.",
          });
          return;
        }

        updateSetting("logoUrl", data.data.logoUrl);
        setFeedback({
          type: "success",
          message: "Logo wurde hochgeladen.",
        });
      } catch {
        setFeedback({
          type: "error",
          message: "Netzwerkfehler. Bitte erneut versuchen.",
        });
      } finally {
        setUploading(false);
      }
    },
    [updateSetting]
  );

  // ── Logo delete ──
  const handleLogoDelete = useCallback(async () => {
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/invoice/logo", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setFeedback({
          type: "error",
          message: data.error || "Fehler beim Entfernen.",
        });
        return;
      }

      updateSetting("logoUrl", undefined);
      setFeedback({
        type: "success",
        message: "Logo wurde entfernt.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    }
  }, [updateSetting]);

  // ── Drag & Drop ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleLogoUpload(files[0]);
      }
    },
    [handleLogoUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleLogoUpload(files[0]);
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleLogoUpload]
  );

  // ── Save settings ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);

    try {
      // Omit logoUrl from the PATCH — it's managed via the logo endpoint
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { logoUrl, ...settingsToSave } = settings;

      const res = await fetch("/api/settings/invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Fehler beim Speichern.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: "Einstellungen wurden gespeichert.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // ── Render ──
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr,minmax(380px,480px)] gap-6">
      {/* ═══ Left: Settings Form ═══ */}
      <div className="space-y-6">
        {/* ── Logo Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <ImageIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Logo</CardTitle>
                <CardDescription>
                  Firmenlogo fuer den Rechnungskopf
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current logo preview */}
            {settings.logoUrl && (
              <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  className="h-12 max-w-[160px] object-contain"
                />
                <div className="flex-1" />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleLogoDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Logo entfernen
                </Button>
              </div>
            )}

            {/* Upload area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200",
                dragOver
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-glow)]"
                  : "border-[var(--glass-border)] hover:border-[var(--color-text-tertiary)] hover:bg-[var(--glass-bg-hover)]",
                uploading && "pointer-events-none opacity-60"
              )}
            >
              <Upload
                className={cn(
                  "h-8 w-8",
                  dragOver
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-tertiary)]"
                )}
                strokeWidth={1.5}
              />
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {uploading
                    ? "Wird hochgeladen..."
                    : "Datei hierher ziehen oder klicken"}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  JPG, PNG, WebP, SVG — max. 2 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Bankverbindung Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-light">
                <CreditCard className="h-4 w-4 text-info" />
              </div>
              <div>
                <CardTitle className="text-base">Bankverbindung</CardTitle>
                <CardDescription>
                  Kontodaten fuer den Rechnungsfuss
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Bank-Name"
              placeholder="z.B. Sparkasse Berlin"
              value={settings.bankName || ""}
              onChange={(e) => updateSetting("bankName", e.target.value)}
            />
            <Input
              label="IBAN"
              placeholder="DE89 3704 0044 0532 0130 00"
              value={settings.bankIban || ""}
              onChange={handleIbanChange}
            />
            <Input
              label="BIC"
              placeholder="z.B. COBADEFFXXX"
              value={settings.bankBic || ""}
              onChange={(e) =>
                updateSetting("bankBic", e.target.value.toUpperCase())
              }
            />
          </CardContent>
        </Card>

        {/* ── Zahlungsbedingungen Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-light">
                <FileText className="h-4 w-4 text-warning" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Zahlungsbedingungen
                </CardTitle>
                <CardDescription>
                  Zahlungsziel und Hinweistext
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Zahlungsziel (Tage)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={settings.paymentTermsDays ?? 14}
                onChange={(e) =>
                  updateSetting(
                    "paymentTermsDays",
                    parseInt(e.target.value) || 0
                  )
                }
                className={cn(
                  "flex h-10 w-full rounded-xl px-3.5 py-2 text-sm",
                  "bg-[var(--glass-bg)] backdrop-blur-xl",
                  "border border-[var(--glass-border)]",
                  "shadow-inner",
                  "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Zahlungshinweis (optional)
              </label>
              <textarea
                rows={2}
                value={settings.paymentTermsText || ""}
                onChange={(e) =>
                  updateSetting("paymentTermsText", e.target.value)
                }
                placeholder="Zahlbar innerhalb von 14 Tagen ohne Abzug"
                className={cn(
                  "flex w-full rounded-xl px-3.5 py-2.5 text-sm resize-none",
                  "bg-[var(--glass-bg)] backdrop-blur-xl",
                  "border border-[var(--glass-border)]",
                  "shadow-inner",
                  "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                  "transition-all duration-200 ease-out",
                  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]"
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Akzentfarbe Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Akzentfarbe</CardTitle>
                <CardDescription>
                  Farbe fuer Rechnungskopf und Akzente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => updateSetting("accentColor", preset.value)}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200",
                    settings.accentColor === preset.value ||
                      (!settings.accentColor && preset.value === "#1D1D1F")
                      ? "bg-black/[0.06] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                      : "hover:bg-black/[0.04]"
                  )}
                  title={preset.name}
                >
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all duration-200 shadow-sm",
                      settings.accentColor === preset.value ||
                        (!settings.accentColor && preset.value === "#1D1D1F")
                        ? "border-white ring-2 ring-offset-1 ring-black/20 scale-110"
                        : "border-white/60 group-hover:scale-105"
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={settings.accentColor || "#1D1D1F"}
                  onChange={(e) =>
                    updateSetting("accentColor", e.target.value)
                  }
                  className="h-10 w-10 rounded-lg border border-[var(--glass-border)] cursor-pointer bg-transparent p-0.5"
                />
              </div>
              <Input
                placeholder="#1D1D1F"
                value={settings.accentColor || "#1D1D1F"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                    updateSetting("accentColor", val);
                  }
                }}
                className="!w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Fusszeile Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <Type className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Fusszeile</CardTitle>
                <CardDescription>
                  Individueller Text am Ende der Rechnung
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={settings.footerText || ""}
              onChange={(e) => updateSetting("footerText", e.target.value)}
              placeholder="Vielen Dank fuer Ihr Vertrauen!"
              className={cn(
                "flex w-full rounded-xl px-3.5 py-2.5 text-sm resize-none",
                "bg-[var(--glass-bg)] backdrop-blur-xl",
                "border border-[var(--glass-border)]",
                "shadow-inner",
                "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                "transition-all duration-200 ease-out",
                "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:bg-[var(--glass-bg-hover)]"
              )}
            />
          </CardContent>
        </Card>

        {/* ── Anzeige Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <ToggleLeft className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Anzeige</CardTitle>
                <CardDescription>
                  Steuerinformationen auf der Rechnung
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.showUstId !== false}
                onChange={(e) =>
                  updateSetting("showUstId", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--glass-border)] text-[var(--color-primary)] accent-[#1D1D1F] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text)] group-hover:text-[var(--color-text)]">
                USt-IdNr. auf Rechnung anzeigen
              </span>
              {organization.ustId && (
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  ({organization.ustId})
                </span>
              )}
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.showTaxId !== false}
                onChange={(e) =>
                  updateSetting("showTaxId", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--glass-border)] text-[var(--color-primary)] accent-[#1D1D1F] cursor-pointer"
              />
              <span className="text-sm text-[var(--color-text)] group-hover:text-[var(--color-text)]">
                Steuernummer auf Rechnung anzeigen
              </span>
              {organization.taxId && (
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  ({organization.taxId})
                </span>
              )}
            </label>
          </CardContent>
        </Card>

        {/* ── Feedback + Save ── */}
        {feedback && (
          <FeedbackMessage type={feedback.type} message={feedback.message} />
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Speichert..." : "Einstellungen speichern"}
          </Button>
        </div>
      </div>

      {/* ═══ Right: Live Preview ═══ */}
      <div className="hidden xl:block">
        <div className="sticky top-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Vorschau</CardTitle>
                  <CardDescription>
                    Live-Vorschau Ihrer Rechnung
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-[var(--glass-border)] overflow-hidden bg-white shadow-inner">
                <iframe
                  ref={iframeRef}
                  title="Rechnungsvorschau"
                  className="w-full border-0"
                  style={{ height: "680px" }}
                  sandbox="allow-same-origin"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
