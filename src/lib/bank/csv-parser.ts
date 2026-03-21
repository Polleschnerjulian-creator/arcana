// ─── Bank CSV Parser with German Bank Templates ─────────────────
//
// Parst CSV-Dateien verschiedener deutscher Banken.
// Unterstützt deutsche Zahlenformate (1.234,56) und Datumsformate (DD.MM.YYYY).

// ─── Types ───────────────────────────────────────────────────────

export interface ParsedBankTransaction {
  date: Date;
  amount: number;
  description: string;
  counterpartName?: string;
  counterpartIban?: string;
}

export interface BankTemplate {
  id: string;
  label: string;
  delimiter: ";" | ",";
  headerRows: number;
  columns: {
    date: number;
    amount: number;
    description: number;
    counterpartName?: number;
    counterpartIban?: number;
    /** Some banks split credit/debit into two columns */
    creditAmount?: number;
  };
  dateFormat: "DD.MM.YYYY" | "DD.MM.YY" | "YYYY-MM-DD";
  numberFormat: "de" | "en";
  encoding?: string;
}

// ─── Templates ───────────────────────────────────────────────────

export const SPARKASSE: BankTemplate = {
  id: "sparkasse",
  label: "Sparkasse",
  delimiter: ";",
  headerRows: 1,
  columns: {
    date: 0,          // Buchungstag
    amount: 14,       // Betrag
    description: 4,   // Verwendungszweck
    counterpartName: 11, // Beguenstigter/Zahlungspflichtiger
    counterpartIban: 12, // Kontonummer/IBAN
  },
  dateFormat: "DD.MM.YY",
  numberFormat: "de",
};

export const DKB: BankTemplate = {
  id: "dkb",
  label: "DKB (Deutsche Kreditbank)",
  delimiter: ";",
  headerRows: 1,
  columns: {
    date: 0,          // Buchungsdatum
    amount: 7,        // Betrag (EUR)
    description: 4,   // Verwendungszweck
    counterpartName: 3, // Auftraggeber / Begünstigter
    counterpartIban: 5,  // Kontonummer
  },
  dateFormat: "DD.MM.YYYY",
  numberFormat: "de",
};

export const ING: BankTemplate = {
  id: "ing",
  label: "ING (DiBa)",
  delimiter: ";",
  headerRows: 1,
  columns: {
    date: 0,          // Buchung
    amount: 7,        // Betrag
    description: 4,   // Verwendungszweck
    counterpartName: 2, // Auftraggeber/Empfänger
    counterpartIban: 3,  // IBAN/Kontonummer
  },
  dateFormat: "DD.MM.YYYY",
  numberFormat: "de",
};

export const COMMERZBANK: BankTemplate = {
  id: "commerzbank",
  label: "Commerzbank",
  delimiter: ";",
  headerRows: 1,
  columns: {
    date: 0,          // Buchungstag
    amount: 4,        // Betrag
    description: 3,   // Buchungstext
    counterpartName: 3, // in Buchungstext enthalten
    counterpartIban: 5,  // IBAN Auftraggeber
  },
  dateFormat: "DD.MM.YYYY",
  numberFormat: "de",
};

export const GENERIC: BankTemplate = {
  id: "generic",
  label: "Generisch (manuell zuordnen)",
  delimiter: ";",
  headerRows: 1,
  columns: {
    date: 0,
    amount: 1,
    description: 2,
    counterpartName: 3,
    counterpartIban: 4,
  },
  dateFormat: "DD.MM.YYYY",
  numberFormat: "de",
};

/** Alle verfügbaren Bank-Templates */
export const BANK_TEMPLATES: BankTemplate[] = [
  SPARKASSE,
  DKB,
  ING,
  COMMERZBANK,
  GENERIC,
];

/** Template nach ID finden */
export function getTemplateById(id: string): BankTemplate | undefined {
  return BANK_TEMPLATES.find((t) => t.id === id);
}

// ─── Parser ──────────────────────────────────────────────────────

/**
 * Parst CSV-Inhalt mit dem angegebenen Bank-Template.
 * Gibt ein Array von ParsedBankTransaction zurück.
 */
export function parseCSV(
  csvContent: string,
  template: BankTemplate
): ParsedBankTransaction[] {
  // BOM entfernen (UTF-8 BOM: \uFEFF)
  let content = csvContent;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Zeilen aufteilen (handle \r\n and \n)
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  // Header-Zeilen überspringen
  const dataLines = lines.slice(template.headerRows);

  const transactions: ParsedBankTransaction[] = [];

  for (const line of dataLines) {
    try {
      const columns = parseCSVLine(line, template.delimiter);

      // Überprüfen, ob genügend Spalten vorhanden sind
      const requiredCol = Math.max(
        template.columns.date,
        template.columns.amount,
        template.columns.description,
        template.columns.counterpartName ?? 0,
        template.columns.counterpartIban ?? 0,
        template.columns.creditAmount ?? 0
      );

      if (columns.length <= requiredCol) {
        continue; // Zeile hat nicht genügend Spalten, überspringen
      }

      // Datum parsen
      const dateStr = columns[template.columns.date]?.trim();
      if (!dateStr) continue;

      const date = parseGermanDate(dateStr, template.dateFormat);
      if (!date || isNaN(date.getTime())) continue;

      // Betrag parsen
      const amountStr = columns[template.columns.amount]?.trim();
      if (!amountStr) continue;

      let amount: number;

      if (
        template.columns.creditAmount !== undefined &&
        template.columns.creditAmount !== template.columns.amount
      ) {
        // Zwei separate Spalten für Soll und Haben
        const debitStr = amountStr;
        const creditStr =
          columns[template.columns.creditAmount]?.trim() || "";

        const debitAmount = debitStr
          ? parseGermanNumber(debitStr, template.numberFormat)
          : 0;
        const creditAmount = creditStr
          ? parseGermanNumber(creditStr, template.numberFormat)
          : 0;

        amount = creditAmount !== 0 ? creditAmount : -debitAmount;
      } else {
        amount = parseGermanNumber(amountStr, template.numberFormat);
      }

      if (isNaN(amount)) continue;

      // Beschreibung
      const description =
        columns[template.columns.description]?.trim() || "";
      if (!description) continue;

      // Gegenpartei (optional)
      const counterpartName =
        template.columns.counterpartName !== undefined
          ? columns[template.columns.counterpartName]?.trim() || undefined
          : undefined;

      const counterpartIban =
        template.columns.counterpartIban !== undefined
          ? columns[template.columns.counterpartIban]?.trim() || undefined
          : undefined;

      transactions.push({
        date,
        amount,
        description,
        counterpartName,
        counterpartIban,
      });
    } catch {
      // Fehlerhafte Zeilen überspringen
      continue;
    }
  }

  return transactions;
}

// ─── CSV Line Parser ─────────────────────────────────────────────

/**
 * Parst eine einzelne CSV-Zeile mit Berücksichtigung von
 * Anführungszeichen und Escaping.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Prüfen auf escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          // Ende des Quoted-Felds
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        result.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  // Letztes Feld hinzufügen
  result.push(current);

  return result;
}

// ─── German Number Format ────────────────────────────────────────

/**
 * Konvertiert deutsche Zahlenformate:
 * "1.234,56" → 1234.56
 * "-1.234,56" → -1234.56
 * "1234,56" → 1234.56
 * "1234.56" → 1234.56 (English format)
 */
export function parseGermanNumber(
  value: string,
  format: "de" | "en" = "de"
): number {
  if (!value || value.trim() === "") return NaN;

  let cleaned = value.trim();

  // Währungssymbole und Leerzeichen entfernen
  cleaned = cleaned.replace(/[€$\s]/g, "");

  // Plus-Zeichen am Anfang entfernen
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  if (format === "de") {
    // Deutsche Notation: Punkt = Tausendertrenner, Komma = Dezimaltrenner
    cleaned = cleaned.replace(/\./g, ""); // Tausendertrenner entfernen
    cleaned = cleaned.replace(/,/, "."); // Komma → Punkt
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

// ─── German Date Format ──────────────────────────────────────────

/**
 * Parst deutsche Datumsformate:
 * "15.01.2024" (DD.MM.YYYY)
 * "15.01.24"   (DD.MM.YY)
 * "2024-01-15" (YYYY-MM-DD)
 */
export function parseGermanDate(
  value: string,
  format: "DD.MM.YYYY" | "DD.MM.YY" | "YYYY-MM-DD" = "DD.MM.YYYY"
): Date | null {
  if (!value || value.trim() === "") return null;

  const cleaned = value.trim();

  try {
    if (format === "YYYY-MM-DD") {
      const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const [, year, month, day] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    if (format === "DD.MM.YYYY") {
      const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (!match) return null;
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    if (format === "DD.MM.YY") {
      const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
      if (!match) return null;
      const [, day, month, yearShort] = match;
      // Annahme: 00-49 = 2000-2049, 50-99 = 1950-1999
      let year = parseInt(yearShort);
      year = year < 50 ? 2000 + year : 1900 + year;
      return new Date(year, parseInt(month) - 1, parseInt(day));
    }
  } catch {
    return null;
  }

  return null;
}
