// ─── Invoice HTML Generation ─────────────────────────────────────
// Generates a self-contained HTML document for a professional German invoice.
// Can be printed to PDF from the browser via window.print().

// ─── Types ───────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceSettings {
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

export interface OrgData {
  name: string;
  street?: string;
  city?: string;
  zip?: string;
  ustId?: string;
  taxId?: string;
  invoiceSettings?: InvoiceSettings;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Format number as German currency: 1.234,56 € */
function formatCurrency(value: number): string {
  return (
    value.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

/** Format ISO date string to German format: 21.03.2026 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Build the org address line for the small sender line */
function orgAddressLine(org: OrgData): string {
  const parts: string[] = [org.name];
  if (org.street) parts.push(org.street);
  if (org.zip && org.city) {
    parts.push(`${org.zip} ${org.city}`);
  } else if (org.city) {
    parts.push(org.city);
  }
  return parts.join(" \u00B7 ");
}

// ─── Main Function ──────────────────────────────────────────────

export function generateInvoiceHTML(
  invoice: InvoiceData,
  org: OrgData
): string {
  const s = org.invoiceSettings || {};
  const accentColor = s.accentColor || "#1D1D1F";
  const showUstId = s.showUstId !== false;
  const showTaxId = s.showTaxId !== false;

  const lineItemsHTML = invoice.lineItems
    .map(
      (item, index) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">${index + 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join("\n");

  const taxLabel =
    invoice.taxRate > 0
      ? `MwSt. ${invoice.taxRate.toLocaleString("de-DE")}%`
      : "MwSt. 0%";

  // Logo HTML
  const logoHtml = s.logoUrl
    ? `<div style="margin-bottom: 8px;"><img src="${escapeHtml(s.logoUrl)}" alt="Logo" style="max-height: 56px; max-width: 200px; object-fit: contain;" /></div>`
    : "";

  // Tax info lines
  const taxInfoHtml: string[] = [];
  if (showUstId && org.ustId) {
    taxInfoHtml.push(
      `<div style="color: #6b7280; margin-top: 4px;">USt-IdNr.: ${escapeHtml(org.ustId)}</div>`
    );
  }
  if (showTaxId && org.taxId) {
    taxInfoHtml.push(
      `<div style="color: #6b7280;">Steuernummer: ${escapeHtml(org.taxId)}</div>`
    );
  }

  // Bank details section
  const hasBankDetails = s.bankName || s.bankIban;
  const bankHtml = hasBankDetails
    ? `
    <div style="margin-bottom: 40px;">
      <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px;">Bankverbindung</div>
      <div style="font-size: 13px; color: #6b7280;">
        Kontoinhaber: ${escapeHtml(org.name)}<br>
        ${s.bankName ? `Bank: ${escapeHtml(s.bankName)}<br>` : ""}
        ${s.bankIban ? `IBAN: ${escapeHtml(s.bankIban)}<br>` : ""}
        ${s.bankBic ? `BIC: ${escapeHtml(s.bankBic)}` : ""}
      </div>
    </div>`
    : `
    <div style="margin-bottom: 40px;">
      <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px;">Bankverbindung</div>
      <div style="font-size: 13px; color: #6b7280;">
        Kontoinhaber: ${escapeHtml(org.name)}<br>
        IBAN: DE00 0000 0000 0000 0000 00<br>
        BIC: XXXXXXXXXXX<br>
        Bank: Musterbank
      </div>
    </div>`;

  // Payment terms
  const paymentTermsText = s.paymentTermsText
    ? escapeHtml(s.paymentTermsText)
    : `Zahlbar bis ${formatDate(invoice.dueDate)} ohne Abzug.`;

  // Footer text
  const footerExtraHtml = s.footerText
    ? `<div style="margin-bottom: 6px; font-size: 12px; color: #6b7280;">${escapeHtml(s.footerText)}</div>`
    : "";

  // Footer tax info
  const footerTaxParts: string[] = [];
  if (showUstId && org.ustId) {
    footerTaxParts.push(`USt-IdNr.: ${escapeHtml(org.ustId)}`);
  }
  if (showTaxId && org.taxId) {
    footerTaxParts.push(`Steuernummer: ${escapeHtml(org.taxId)}`);
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .page { box-shadow: none !important; margin: 0 !important; padding: 40px 50px !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      background: #f3f4f6;
    }
    .page {
      max-width: 800px;
      margin: 32px auto;
      background: #fff;
      padding: 60px 64px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Accent bar -->
    <div style="height: 4px; background: ${accentColor}; margin-bottom: 48px; border-radius: 2px;"></div>

    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px;">
      <div>
        ${logoHtml}
        <div style="font-size: 22px; font-weight: 700; color: #111827;">${escapeHtml(org.name)}</div>
        ${org.street ? `<div style="color: #6b7280; margin-top: 4px;">${escapeHtml(org.street)}</div>` : ""}
        ${org.zip || org.city ? `<div style="color: #6b7280;">${escapeHtml([org.zip, org.city].filter(Boolean).join(" "))}</div>` : ""}
        ${taxInfoHtml.join("\n        ")}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 28px; font-weight: 800; color: ${accentColor}; letter-spacing: -0.5px;">RECHNUNG</div>
        <div style="color: #6b7280; margin-top: 4px;">Nr. ${escapeHtml(invoice.invoiceNumber)}</div>
      </div>
    </div>

    <!-- Small sender line above address -->
    <div style="font-size: 9px; color: #9ca3af; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 4px; max-width: 360px;">
      ${escapeHtml(orgAddressLine(org))}
    </div>

    <!-- Customer + Meta -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
      <div style="max-width: 360px;">
        <div style="font-weight: 600; font-size: 15px;">${escapeHtml(invoice.customerName)}</div>
        ${invoice.customerAddress ? `<div style="white-space: pre-line; color: #4b5563; margin-top: 2px;">${escapeHtml(invoice.customerAddress)}</div>` : ""}
      </div>
      <div style="text-align: right; font-size: 13px; color: #4b5563;">
        <div><span style="color: #9ca3af;">Rechnungsdatum:</span> ${formatDate(invoice.issueDate)}</div>
        <div style="margin-top: 2px;"><span style="color: #9ca3af;">F\u00E4llig am:</span> ${formatDate(invoice.dueDate)}</div>
      </div>
    </div>

    <!-- Line Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 10px 12px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid ${accentColor}20; width: 50px;">Pos.</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid ${accentColor}20;">Beschreibung</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid ${accentColor}20; width: 80px;">Menge</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid ${accentColor}20; width: 120px;">Einzelpreis</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid ${accentColor}20; width: 120px;">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
      <div style="width: 280px;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #4b5563;">
          <span>Nettobetrag</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #4b5563; border-bottom: 1px solid #e5e7eb;">
          <span>${taxLabel}</span>
          <span>${formatCurrency(invoice.taxAmount)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; color: ${accentColor};">
          <span>Bruttobetrag</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>
    </div>

    <!-- Payment Terms -->
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 20px; margin-bottom: 32px;">
      <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 4px;">Zahlungsbedingungen</div>
      <div style="font-size: 13px; color: #4b5563;">
        ${paymentTermsText}
      </div>
    </div>

    <!-- Bank Details -->
    ${bankHtml}

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center;">
      ${footerExtraHtml}
      ${escapeHtml(org.name)}${org.street ? ` \u00B7 ${escapeHtml(org.street)}` : ""}${org.zip || org.city ? ` \u00B7 ${escapeHtml([org.zip, org.city].filter(Boolean).join(" "))}` : ""}
      ${footerTaxParts.length > 0 ? `<br>${footerTaxParts.join(" \u00B7 ")}` : ""}
    </div>

  </div>

  <!-- Print Button (hidden on print) -->
  <div class="no-print" style="text-align: center; margin: 24px 0 48px;">
    <button onclick="window.print()" style="padding: 10px 32px; font-size: 14px; font-weight: 600; background: ${accentColor}; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
      Als PDF drucken
    </button>
  </div>
</body>
</html>`;
}

// ─── Utility ─────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
