// ─── Mahnwesen (Dunning / Payment Reminders) ─────────────────────
// Generates professional German dunning letters at three escalation levels.

// ─── Types ───────────────────────────────────────────────────────

export interface DunningInvoice {
  invoiceNumber: string;
  customerName: string;
  customerAddress?: string;
  dueDate: Date;
  total: number;
  status: string;
}

export interface DunningOrgData {
  name: string;
  street?: string;
  city?: string;
  zip?: string;
  ustId?: string;
  taxId?: string;
  bankName?: string;
  bankIban?: string;
  bankBic?: string;
}

export interface DunningLevelInfo {
  level: number;
  label: string; // "Zahlungserinnerung" | "1. Mahnung" | "2. Mahnung"
  suggestedFee: number; // 0 for reminder, 5 for 1st, 10 for 2nd
  newDueDate: Date; // +14 days from today
}

// ─── Dunning Level Logic ─────────────────────────────────────────

/**
 * Determines the appropriate dunning level based on:
 * - How many days overdue the invoice is
 * - How many dunning entries already exist
 *
 * Levels:
 *   1 (7+ days overdue):  Zahlungserinnerung — friendly reminder, no fee
 *   2 (21+ days overdue): 1. Mahnung — formal, 5 EUR fee
 *   3 (35+ days overdue): 2. Mahnung — final warning, 10 EUR fee
 */
export function getDunningLevel(
  invoice: { dueDate: Date; status: string },
  existingEntries: number
): DunningLevelInfo {
  const now = new Date();
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / 86400000)
  );

  // Determine level from existing entries (next step)
  // If already sent level X, next is X+1 (capped at 3)
  let level = Math.min(existingEntries + 1, 3);

  // But also respect minimum overdue thresholds
  if (daysOverdue < 7) {
    level = 1; // Even if forced, at minimum level 1
  } else if (daysOverdue < 21 && level > 1) {
    level = Math.min(level, 1);
  } else if (daysOverdue < 35 && level > 2) {
    level = Math.min(level, 2);
  }

  // Ensure minimum level 1
  if (level < 1) level = 1;

  const newDueDate = new Date();
  newDueDate.setDate(newDueDate.getDate() + 14);

  const config: Record<number, { label: string; suggestedFee: number }> = {
    1: { label: "Zahlungserinnerung", suggestedFee: 0 },
    2: { label: "1. Mahnung", suggestedFee: 5 },
    3: { label: "2. Mahnung", suggestedFee: 10 },
  };

  const { label, suggestedFee } = config[level] || config[1];

  return { level, label, suggestedFee, newDueDate };
}

// ─── HTML Generation ─────────────────────────────────────────────

export function generateDunningHTML(
  invoice: DunningInvoice,
  org: DunningOrgData,
  level: number,
  fee: number,
  newDueDate: Date
): string {
  const config: Record<number, { title: string; greeting: string; body: string; closing: string }> = {
    1: {
      title: "Zahlungserinnerung",
      greeting: "Sehr geehrte Damen und Herren,",
      body: `bei der Durchsicht unserer Konten haben wir festgestellt, dass die nachstehend aufgeführte Rechnung noch nicht beglichen wurde. Sicherlich handelt es sich um ein Versehen. Wir bitten Sie daher höflich, den offenen Betrag bis zum <strong>${formatDate(newDueDate)}</strong> auf unser unten genanntes Konto zu überweisen.

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.`,
      closing: "Mit freundlichen Grüßen",
    },
    2: {
      title: "1. Mahnung",
      greeting: "Sehr geehrte Damen und Herren,",
      body: `trotz unserer Zahlungserinnerung konnten wir leider noch keinen Zahlungseingang für die nachstehend aufgeführte Rechnung feststellen. Wir bitten Sie dringend, den fälligen Betrag${fee > 0 ? " zuzüglich der angefallenen Mahngebühren" : ""} bis zum <strong>${formatDate(newDueDate)}</strong> zu begleichen.`,
      closing: "Mit freundlichen Grüßen",
    },
    3: {
      title: "2. Mahnung",
      greeting: "Sehr geehrte Damen und Herren,",
      body: `trotz wiederholter Aufforderung ist die nachstehend aufgeführte Rechnung weiterhin unbezahlt. Wir fordern Sie hiermit letztmalig auf, den Gesamtbetrag${fee > 0 ? " einschließlich der Mahngebühren" : ""} bis spätestens <strong>${formatDate(newDueDate)}</strong> auf unser Konto zu überweisen.

Sollte bis zum genannten Datum kein Zahlungseingang erfolgen, sehen wir uns gezwungen, ohne weitere Ankündigung rechtliche Schritte einzuleiten und die Forderung an ein Inkassounternehmen zu übergeben. Die daraus entstehenden Kosten gehen zu Ihren Lasten.`,
      closing: "Mit freundlichen Grüßen",
    },
  };

  const c = config[level] || config[1];
  const totalWithFee = invoice.total + fee;

  // Build org address
  const orgAddressParts: string[] = [org.name];
  if (org.street) orgAddressParts.push(org.street);
  if (org.zip && org.city) orgAddressParts.push(`${org.zip} ${org.city}`);
  else if (org.city) orgAddressParts.push(org.city);
  const orgAddressLine = orgAddressParts.join(" \u00B7 ");

  // Bank details
  const bankHtml =
    org.bankIban || org.bankName
      ? `
    <div style="margin-top: 32px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 20px;">
      <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px;">Bankverbindung</div>
      <div style="font-size: 13px; color: #6b7280;">
        Kontoinhaber: ${esc(org.name)}<br>
        ${org.bankName ? `Bank: ${esc(org.bankName)}<br>` : ""}
        ${org.bankIban ? `IBAN: ${esc(org.bankIban)}<br>` : ""}
        ${org.bankBic ? `BIC: ${esc(org.bankBic)}` : ""}
      </div>
    </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(c.title)} - ${esc(invoice.invoiceNumber)}</title>
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
      line-height: 1.6;
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
    <div style="height: 4px; background: ${level >= 3 ? "#dc2626" : level >= 2 ? "#ea580c" : "#1D1D1F"}; margin-bottom: 48px; border-radius: 2px;"></div>

    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px;">
      <div>
        <div style="font-size: 22px; font-weight: 700; color: #111827;">${esc(org.name)}</div>
        ${org.street ? `<div style="color: #6b7280; margin-top: 4px;">${esc(org.street)}</div>` : ""}
        ${org.zip || org.city ? `<div style="color: #6b7280;">${esc([org.zip, org.city].filter(Boolean).join(" "))}</div>` : ""}
        ${org.ustId ? `<div style="color: #6b7280; margin-top: 4px;">USt-IdNr.: ${esc(org.ustId)}</div>` : ""}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 24px; font-weight: 800; color: ${level >= 3 ? "#dc2626" : level >= 2 ? "#ea580c" : "#1D1D1F"}; letter-spacing: -0.5px; text-transform: uppercase;">
          ${esc(c.title)}
        </div>
        <div style="color: #6b7280; margin-top: 4px;">Zu Rechnung ${esc(invoice.invoiceNumber)}</div>
        <div style="color: #6b7280; margin-top: 2px;">Datum: ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <!-- Small sender line -->
    <div style="font-size: 9px; color: #9ca3af; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; margin-bottom: 4px; max-width: 360px;">
      ${esc(orgAddressLine)}
    </div>

    <!-- Customer address -->
    <div style="max-width: 360px; margin-bottom: 48px;">
      <div style="font-weight: 600; font-size: 15px;">${esc(invoice.customerName)}</div>
      ${invoice.customerAddress ? `<div style="white-space: pre-line; color: #4b5563; margin-top: 2px;">${esc(invoice.customerAddress)}</div>` : ""}
    </div>

    <!-- Body -->
    <div style="margin-bottom: 32px;">
      <p style="margin-bottom: 16px;">${c.greeting}</p>
      <p style="margin-bottom: 16px;">${c.body}</p>
    </div>

    <!-- Invoice details table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Rechnungsnr.</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Urspr. Fällig</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Rechnungsbetrag</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${esc(invoice.invoiceNumber)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(invoice.dueDate.toISOString())}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(invoice.total)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
      <div style="width: 300px;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #4b5563;">
          <span>Rechnungsbetrag</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
        ${fee > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #4b5563; border-bottom: 1px solid #e5e7eb;">
          <span>Mahngeb\u00FChr</span>
          <span>${formatCurrency(fee)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; color: ${level >= 3 ? "#dc2626" : level >= 2 ? "#ea580c" : "#1D1D1F"};">
          <span>Gesamtbetrag</span>
          <span>${formatCurrency(totalWithFee)}</span>
        </div>
      </div>
    </div>

    <!-- Payment info -->
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 20px; margin-bottom: 32px;">
      <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 4px;">Zahlungsziel</div>
      <div style="font-size: 13px; color: #4b5563;">
        Bitte \u00FCberweisen Sie den Gesamtbetrag von <strong>${formatCurrency(totalWithFee)}</strong> bis zum <strong>${formatDate(newDueDate.toISOString())}</strong>.
      </div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 6px;">
        Verwendungszweck: ${esc(invoice.invoiceNumber)}
      </div>
    </div>

    <!-- Bank details -->
    ${bankHtml}

    <!-- Closing -->
    <div style="margin-top: 40px;">
      <p style="margin-bottom: 32px;">${c.closing}</p>
      <p style="font-weight: 600;">${esc(org.name)}</p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 48px; font-size: 11px; color: #9ca3af; text-align: center;">
      ${esc(org.name)}${org.street ? ` \u00B7 ${esc(org.street)}` : ""}${org.zip || org.city ? ` \u00B7 ${esc([org.zip, org.city].filter(Boolean).join(" "))}` : ""}
      ${org.ustId ? `<br>USt-IdNr.: ${esc(org.ustId)}` : ""}${org.taxId ? ` \u00B7 Steuernummer: ${esc(org.taxId)}` : ""}
    </div>

  </div>

  <!-- Print Button (hidden on print) -->
  <div class="no-print" style="text-align: center; margin: 24px 0 48px;">
    <button onclick="window.print()" style="padding: 10px 32px; font-size: 14px; font-weight: 600; background: #1D1D1F; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
      Als PDF drucken
    </button>
  </div>
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return (
    value.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

function formatDate(dateStr: string | Date): string {
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
