import { prisma } from "@/lib/db";

// ─── Generic CSV Export ──────────────────────────────────────────
//
// Erzeugt eine einfache CSV-Datei mit allen BOOKED Transaktionen
// im gewählten Zeitraum. Geeignet für Excel, LibreOffice und
// andere Tabellenkalkulationen.
//
// Format: Semikolon-getrennt, deutsches Zahlenformat, UTF-8 mit BOM.

/**
 * Generiert eine CSV-Datei mit allen gebuchten Transaktionen
 * im gegebenen Zeitraum.
 *
 * Spalten: Datum, Belegnummer, Beschreibung, Soll-Konto,
 *          Soll-Betrag, Haben-Konto, Haben-Betrag, Steuer
 *
 * @returns UTF-8-String mit BOM-Prefix
 */
export async function generateTransactionCSV(
  organizationId: string,
  from: Date,
  to: Date
): Promise<string> {
  // Ensure 'to' includes the full day
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  // Fetch all BOOKED transactions with lines and accounts
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      status: "BOOKED",
      date: { gte: from, lte: toEnd },
    },
    include: {
      lines: {
        include: {
          account: { select: { number: true, name: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const lines: string[] = [];

  // UTF-8 BOM
  const BOM = "\uFEFF";

  // Header row
  lines.push([
    "Datum",
    "Belegnummer",
    "Beschreibung",
    "Soll-Konto",
    "Soll-Kontoname",
    "Soll-Betrag",
    "Haben-Konto",
    "Haben-Kontoname",
    "Haben-Betrag",
    "Steuer (%)",
  ].join(";"));

  // Data rows — one row per transaction line
  for (const tx of transactions) {
    const datum = formatDateDE(tx.date);
    const beleg = escapeCSV(tx.reference || "");
    const beschreibung = escapeCSV(tx.description);

    for (const line of tx.lines) {
      const debitAmount = Number(line.debit);
      const creditAmount = Number(line.credit);

      const row = [
        datum,
        `"${beleg}"`,
        `"${beschreibung}"`,
        debitAmount > 0 ? line.account.number : "",
        debitAmount > 0 ? `"${escapeCSV(line.account.name)}"` : "",
        debitAmount > 0 ? formatGermanNumber(debitAmount) : "",
        creditAmount > 0 ? line.account.number : "",
        creditAmount > 0 ? `"${escapeCSV(line.account.name)}"` : "",
        creditAmount > 0 ? formatGermanNumber(creditAmount) : "",
        line.taxRate != null ? formatGermanNumber(line.taxRate) : "",
      ];

      lines.push(row.join(";"));
    }
  }

  return BOM + lines.join("\r\n") + "\r\n";
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Formatiert ein Datum im deutschen Format: DD.MM.YYYY
 */
function formatDateDE(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

/**
 * Formatiert eine Zahl im deutschen Zahlenformat.
 *
 * Beispiel: 1234.56 -> "1.234,56"
 */
function formatGermanNumber(value: number): string {
  // Use toFixed for consistent 2 decimal places
  const parts = value.toFixed(2).split(".");
  // Add thousand separators to integer part
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intPart},${parts[1]}`;
}

/**
 * Bereinigt einen String für die Verwendung in CSV-Feldern.
 */
function escapeCSV(value: string): string {
  return value
    .replace(/"/g, '""')
    .replace(/\r?\n/g, " ");
}
