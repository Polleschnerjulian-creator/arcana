import { prisma } from "@/lib/db";

// ─── DATEV Buchungsstapel Export ─────────────────────────────────
//
// Erzeugt eine DATEV-konforme CSV-Datei im Buchungsstapel-Format
// (EXTF 700, Format 21). Kompatibel mit DATEV Unternehmen online,
// Kanzlei-Rechnungswesen und allen gängigen Steuerberater-Tools.

/**
 * Generiert einen DATEV Buchungsstapel (ASCII CSV) für den
 * gegebenen Zeitraum.
 *
 * Nur BOOKED-Transaktionen werden exportiert.
 *
 * @returns UTF-8-String im DATEV-Buchungsstapel-Format
 */
export async function generateDATEV(
  organizationId: string,
  from: Date,
  to: Date
): Promise<string> {
  // Load organization for metadata
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      name: true,
      taxId: true,
      chartOfAccounts: true,
      fiscalYearStart: true,
    },
  });

  // Ensure 'to' includes the full day
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  // Fetch all BOOKED transactions with their lines
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      status: "BOOKED",
      date: { gte: from, lte: toEnd },
    },
    include: {
      lines: {
        include: {
          account: { select: { number: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Build the DATEV file
  const lines: string[] = [];

  // ─── Header Line 1 (Formatkennung) ──────────────────────────
  // DATEV EXTF format version 700, type 21 = Buchungsstapel
  const fiscalYearBegin = new Date(from.getFullYear(), org.fiscalYearStart - 1, 1);
  const headerFields = [
    '"EXTF"',                              // 1: Format
    "700",                                 // 2: Versionsnummer
    "21",                                  // 3: Datenkategorie (21 = Buchungsstapel)
    '"Buchungsstapel"',                    // 4: Formatname
    "13",                                  // 5: Formatversion
    formatDateDATEV_YYYYMMDD(new Date()),  // 6: Erzeugt am
    "",                                    // 7: Importiert (leer)
    '"ARCANA"',                            // 8: Herkunft
    '""',                                  // 9: Exportiert von
    '""',                                  // 10: Importiert von
    org.taxId ? `"${org.taxId}"` : '""',   // 11: Berater-Nr (Steuernr)
    '""',                                  // 12: Mandanten-Nr
    formatDateDATEV_YYYYMMDD(fiscalYearBegin), // 13: WJ-Beginn
    org.chartOfAccounts === "SKR04" ? "4" : "3", // 14: Sachkontenlänge
    formatDateDATEV_YYYYMMDD(from),        // 15: Datum von
    formatDateDATEV_YYYYMMDD(to),          // 16: Datum bis
    '""',                                  // 17: Bezeichnung
    '""',                                  // 18: Diktatkürzel
    "1",                                   // 19: Buchungstyp (1 = Fibu)
    "0",                                   // 20: Rechnungslegungszweck
    "0",                                   // 21: Festschreibung
    '"EUR"',                               // 22: WKZ
    "",                                    // 23-... Reservefelder
  ];
  lines.push(headerFields.join(";"));

  // ─── Header Line 2 (Spaltenüberschriften) ────────────────────
  const columnHeaders = [
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Buchungstext",
  ];
  lines.push(columnHeaders.join(";"));

  // ─── Data Lines ──────────────────────────────────────────────
  for (const tx of transactions) {
    // For each transaction we need to create DATEV lines.
    // DATEV uses a paired format: each line has Konto + Gegenkonto.
    //
    // Strategy: For transactions with exactly 2 lines, create one
    // DATEV line. For complex split bookings (>2 lines), create
    // multiple lines using the first line's account as counter-account.

    if (tx.lines.length === 2) {
      // Simple two-line booking
      const debitLine = tx.lines.find((l) => Number(l.debit) > 0);
      const creditLine = tx.lines.find((l) => Number(l.credit) > 0);

      if (debitLine && creditLine) {
        const amount = Number(debitLine.debit);
        const buKey = getBuSchluessel(debitLine.taxRate);

        lines.push(buildDataLine(
          amount,
          "S",
          debitLine.account.number,
          creditLine.account.number,
          buKey,
          tx.date,
          tx.reference || "",
          tx.description
        ));
      }
    } else {
      // Complex split booking: emit one DATEV line per transaction line
      // Each debit line is paired against the first credit line's account,
      // and vice versa.
      const debitLines = tx.lines.filter((l) => Number(l.debit) > 0);
      const creditLines = tx.lines.filter((l) => Number(l.credit) > 0);

      // Pair debit lines against first credit account
      if (creditLines.length > 0) {
        const counterAccount = creditLines[0].account.number;
        for (const dLine of debitLines) {
          const amount = Number(dLine.debit);
          const buKey = getBuSchluessel(dLine.taxRate);
          lines.push(buildDataLine(
            amount,
            "S",
            dLine.account.number,
            counterAccount,
            buKey,
            tx.date,
            tx.reference || "",
            tx.description
          ));
        }
      }

      // If there are multiple credit lines, pair additional ones
      // against the first debit account
      if (debitLines.length > 0 && creditLines.length > 1) {
        const counterAccount = debitLines[0].account.number;
        for (let i = 1; i < creditLines.length; i++) {
          const cLine = creditLines[i];
          const amount = Number(cLine.credit);
          const buKey = getBuSchluessel(cLine.taxRate);
          lines.push(buildDataLine(
            amount,
            "H",
            cLine.account.number,
            counterAccount,
            buKey,
            tx.date,
            tx.reference || "",
            tx.description
          ));
        }
      }
    }
  }

  return lines.join("\r\n") + "\r\n";
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildDataLine(
  amount: number,
  sollHaben: "S" | "H",
  konto: string,
  gegenkonto: string,
  buSchluessel: string,
  date: Date,
  reference: string,
  description: string
): string {
  const fields = [
    formatGermanNumber(amount),              // 1: Umsatz
    sollHaben,                               // 2: Soll/Haben-Kennzeichen
    '"EUR"',                                 // 3: WKZ
    "",                                      // 4: Kurs
    "",                                      // 5: Basis-Umsatz
    konto,                                   // 6: Konto
    gegenkonto,                              // 7: Gegenkonto
    buSchluessel,                            // 8: BU-Schlüssel
    formatBelegdatum(date),                  // 9: Belegdatum (DDMM)
    `"${escapeCSV(reference).substring(0, 36)}"`, // 10: Belegfeld 1 (max 36)
    `"${escapeCSV(description).substring(0, 60)}"`, // 11: Buchungstext (max 60)
  ];

  return fields.join(";");
}

/**
 * DATEV BU-Schlüssel für Steuersätze:
 * - leer: kein Steuer-Automatikkonto
 * - "2": 7% USt / VSt
 * - "3": 19% USt / VSt
 */
function getBuSchluessel(taxRate: number | null | undefined): string {
  if (taxRate === 7) return "2";
  if (taxRate === 19) return "3";
  return "";
}

/**
 * Formatiert ein Datum im DATEV-Belegdatum-Format: DDMM
 * (ohne Jahr, da im Header definiert)
 */
function formatBelegdatum(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}${month}`;
}

/**
 * Formatiert ein Datum im DATEV-Format: YYYYMMDD
 */
function formatDateDATEV_YYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Formatiert eine Zahl im deutschen Zahlenformat:
 * Komma als Dezimaltrenner, kein Tausendertrenner.
 *
 * Beispiel: 1234.56 -> "1234,56"
 */
function formatGermanNumber(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Bereinigt einen String für die Verwendung in CSV-Feldern.
 * Entfernt Anführungszeichen und Semikolons.
 */
function escapeCSV(value: string): string {
  return value
    .replace(/"/g, "")
    .replace(/;/g, " ")
    .replace(/\r?\n/g, " ");
}
