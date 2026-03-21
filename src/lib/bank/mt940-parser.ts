// ─── MT940/SWIFT Format Parser ───────────────────────────────────
//
// Vereinfachter Parser für MT940-Kontoauszüge (SWIFT).
// Unterstützt die gängigsten Strukturen deutscher Banken.

import type { ParsedBankTransaction } from "./csv-parser";

// ─── Types ───────────────────────────────────────────────────────

interface MT940Statement {
  accountNumber?: string;
  statementNumber?: string;
  transactions: ParsedBankTransaction[];
}

interface RawMT940Transaction {
  date: string;        // YYMMDD
  entryDate?: string;  // MMDD
  debitCredit: "D" | "C" | "RD" | "RC";
  amount: string;      // z.B. "1234,56"
  transactionType?: string;
  reference?: string;
  description: string;
  counterpartName?: string;
  counterpartIban?: string;
}

// ─── Main Parser ─────────────────────────────────────────────────

/**
 * Parst MT940-Inhalt und gibt ParsedBankTransaction[] zurück.
 *
 * MT940-Struktur:
 * :20: - Transaction Reference Number
 * :25: - Account Identification
 * :28C: - Statement Number
 * :60F: - Opening Balance
 * :61: - Transaction line (Statement Line)
 * :86: - Information to Account Owner (Details)
 * :62F: - Closing Balance
 */
export function parseMT940(content: string): ParsedBankTransaction[] {
  // BOM entfernen
  let text = content;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Normalisierung: \r\n → \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const statements = splitStatements(text);
  const allTransactions: ParsedBankTransaction[] = [];

  for (const statement of statements) {
    const parsed = parseStatement(statement);
    allTransactions.push(...parsed.transactions);
  }

  return allTransactions;
}

// ─── Statement Splitter ──────────────────────────────────────────

/**
 * Teilt den MT940-Inhalt in einzelne Kontoauszüge auf.
 * Jeder Auszug beginnt mit :20: und endet mit :62F: oder :62M:
 */
function splitStatements(content: string): string[] {
  const statements: string[] = [];
  const parts = content.split(/(?=:20:)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(":20:")) {
      statements.push(trimmed);
    }
  }

  // Wenn keine :20:-Tags gefunden, den gesamten Inhalt als ein Statement behandeln
  if (statements.length === 0 && content.trim().length > 0) {
    statements.push(content.trim());
  }

  return statements;
}

// ─── Single Statement Parser ─────────────────────────────────────

function parseStatement(statementText: string): MT940Statement {
  const result: MT940Statement = {
    transactions: [],
  };

  // Account Identification (:25:)
  const accountMatch = statementText.match(/:25:(.+?)(?:\n|$)/);
  if (accountMatch) {
    result.accountNumber = accountMatch[1].trim();
  }

  // Statement Number (:28C:)
  const stmtMatch = statementText.match(/:28[Cc]:(.+?)(?:\n|$)/);
  if (stmtMatch) {
    result.statementNumber = stmtMatch[1].trim();
  }

  // Transaktionen extrahieren (:61: und :86:)
  const rawTransactions = extractTransactions(statementText);

  for (const raw of rawTransactions) {
    const parsed = convertRawTransaction(raw);
    if (parsed) {
      result.transactions.push(parsed);
    }
  }

  return result;
}

// ─── Transaction Extraction ──────────────────────────────────────

/**
 * Extrahiert :61: und zugehörige :86: Blöcke aus dem Statement.
 */
function extractTransactions(text: string): RawMT940Transaction[] {
  const transactions: RawMT940Transaction[] = [];

  // Alle :61:-Zeilen finden und den zugehörigen :86:-Block extrahieren
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith(":61:")) {
      const transactionLine = line.substring(4);

      // Mehrzeilige :61:-Felder sammeln (selten, aber möglich)
      let fullLine = transactionLine;
      while (
        i + 1 < lines.length &&
        !lines[i + 1].trim().startsWith(":") &&
        lines[i + 1].trim().length > 0
      ) {
        i++;
        fullLine += " " + lines[i].trim();
      }

      // :86:-Block sammeln (kann mehrere Zeilen umfassen)
      let descriptionBlock = "";
      if (
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith(":86:")
      ) {
        i++;
        descriptionBlock = lines[i].trim().substring(4);

        // Folgezeilen des :86:-Blocks sammeln
        while (
          i + 1 < lines.length &&
          !lines[i + 1].trim().startsWith(":") &&
          lines[i + 1].trim().length > 0
        ) {
          i++;
          descriptionBlock += " " + lines[i].trim();
        }
      }

      const raw = parseTransactionLine(fullLine, descriptionBlock);
      if (raw) {
        transactions.push(raw);
      }
    }

    i++;
  }

  return transactions;
}

// ─── :61: Line Parser ────────────────────────────────────────────

/**
 * Parst eine :61:-Transaktionszeile.
 *
 * Format (vereinfacht):
 * :61:YYMMDD[MMDD]D/C[code]Amount[type][reference]
 *
 * Beispiel:
 * :61:2401150115D1234,56NTRFNONREF
 * :61:240115D1234,56NTRFNONREF
 */
function parseTransactionLine(
  line: string,
  descriptionBlock: string
): RawMT940Transaction | null {
  if (!line || line.trim().length < 10) return null;

  const trimmed = line.trim();

  // Datum extrahieren: YYMMDD (Pflicht)
  const dateStr = trimmed.substring(0, 6);
  if (!/^\d{6}$/.test(dateStr)) return null;

  let pos = 6;

  // Optionales Entry-Datum: MMDD
  let entryDate: string | undefined;
  if (pos + 4 <= trimmed.length && /^\d{4}/.test(trimmed.substring(pos, pos + 4))) {
    // Prüfe ob es wirklich ein MMDD ist (nicht der D/C-Indikator)
    const potentialDate = trimmed.substring(pos, pos + 4);
    const nextChar = trimmed.charAt(pos + 4);
    if (/^[DC]$/.test(nextChar) || /^R[DC]$/.test(trimmed.substring(pos + 4, pos + 6))) {
      entryDate = potentialDate;
      pos += 4;
    }
  }

  // Soll/Haben-Indikator: D, C, RD, RC
  let debitCredit: "D" | "C" | "RD" | "RC";
  if (trimmed.substring(pos, pos + 2) === "RD") {
    debitCredit = "RD";
    pos += 2;
  } else if (trimmed.substring(pos, pos + 2) === "RC") {
    debitCredit = "RC";
    pos += 2;
  } else if (trimmed.charAt(pos) === "D") {
    debitCredit = "D";
    pos += 1;
  } else if (trimmed.charAt(pos) === "C") {
    debitCredit = "C";
    pos += 1;
  } else {
    return null;
  }

  // Optionaler Drittwährungskennbuchstabe (ein Buchstabe)
  if (/^[A-Z]$/.test(trimmed.charAt(pos)) && /^\d/.test(trimmed.charAt(pos + 1))) {
    pos += 1;
  }

  // Betrag: Ziffern und Komma bis zum nächsten Buchstaben
  const amountMatch = trimmed.substring(pos).match(/^(\d+,\d*)/);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1];
  pos += amountStr.length;

  // Transaktionstyp: N + 3 Buchstaben (z.B. NTRF, NCHK)
  let transactionType: string | undefined;
  const typeMatch = trimmed.substring(pos).match(/^([A-Z]\d{3}|[A-Z]{4})/);
  if (typeMatch) {
    transactionType = typeMatch[1];
    pos += transactionType.length;
  }

  // Referenz: Rest der Zeile
  const reference = trimmed.substring(pos).trim() || undefined;

  // :86:-Block parsen für Details
  const details = parseDescriptionBlock(descriptionBlock);

  return {
    date: dateStr,
    entryDate,
    debitCredit,
    amount: amountStr,
    transactionType,
    reference,
    description: details.description || descriptionBlock || reference || "",
    counterpartName: details.counterpartName,
    counterpartIban: details.counterpartIban,
  };
}

// ─── :86: Description Block Parser ───────────────────────────────

interface DescriptionDetails {
  description: string;
  counterpartName?: string;
  counterpartIban?: string;
}

/**
 * Parst den :86:-Beschreibungsblock.
 *
 * Zwei Formate:
 * 1. Strukturiert mit ?-Feldern: ?20Verwendungszweck?21Fortsetzung?32Name?30BLZ?31Konto
 * 2. Unstrukturiert: Freitext
 */
function parseDescriptionBlock(block: string): DescriptionDetails {
  if (!block) {
    return { description: "" };
  }

  // Prüfen, ob strukturiertes Format (beginnt mit Geschäftsvorfallcode + ?)
  if (block.includes("?")) {
    return parseStructuredDescription(block);
  }

  // Unstrukturiert: gesamten Block als Beschreibung verwenden
  return { description: block.trim() };
}

/**
 * Parst strukturierte :86:-Blöcke mit ?XX-Feldern:
 *
 * ?00 - Geschäftsvorfallcode
 * ?10 - Primanota
 * ?20-?29 - Verwendungszweck (bis zu 10 Zeilen)
 * ?30 - BLZ Auftraggeber/Zahlungsempfänger
 * ?31 - Kontonummer
 * ?32-?33 - Name Auftraggeber/Zahlungsempfänger
 * ?34 - Textschlüsselergänzung
 * ?60-?63 - Weitere Verwendungszweckzeilen
 */
function parseStructuredDescription(block: string): DescriptionDetails {
  const fields = new Map<string, string>();

  // ?XX-Felder extrahieren
  const parts = block.split("?");
  for (const part of parts) {
    if (part.length >= 2) {
      const code = part.substring(0, 2);
      const value = part.substring(2).trim();
      if (/^\d{2}$/.test(code)) {
        // Wenn der Code bereits existiert, anhängen (z.B. mehrere Verwendungszweck-Zeilen)
        const existing = fields.get(code);
        if (existing) {
          fields.set(code, existing + " " + value);
        } else {
          fields.set(code, value);
        }
      }
    }
  }

  // Verwendungszweck zusammensetzen (?20-?29, ?60-?63)
  const descParts: string[] = [];
  for (let i = 20; i <= 29; i++) {
    const val = fields.get(i.toString().padStart(2, "0"));
    if (val) descParts.push(val);
  }
  for (let i = 60; i <= 63; i++) {
    const val = fields.get(i.toString());
    if (val) descParts.push(val);
  }

  const description = descParts.join(" ").trim();

  // Gegenpartei-Name (?32 + ?33)
  let counterpartName: string | undefined;
  const name32 = fields.get("32");
  const name33 = fields.get("33");
  if (name32) {
    counterpartName = name32;
    if (name33) {
      counterpartName += " " + name33;
    }
    counterpartName = counterpartName.trim();
  }

  // IBAN (?31 oder aus Verwendungszweck extrahieren)
  let counterpartIban: string | undefined;
  const iban31 = fields.get("31");
  if (iban31) {
    counterpartIban = iban31.trim();
  }

  // Fallback: IBAN aus Verwendungszweck extrahieren
  if (!counterpartIban && description) {
    const ibanMatch = description.match(
      /[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2,4}/
    );
    if (ibanMatch) {
      counterpartIban = ibanMatch[0].replace(/\s/g, "");
    }
  }

  return {
    description: description || block.trim(),
    counterpartName: counterpartName || undefined,
    counterpartIban: counterpartIban || undefined,
  };
}

// ─── Raw → Parsed Conversion ────────────────────────────────────

function convertRawTransaction(
  raw: RawMT940Transaction
): ParsedBankTransaction | null {
  // Datum konvertieren: YYMMDD → Date
  const year = parseInt(raw.date.substring(0, 2));
  const month = parseInt(raw.date.substring(2, 4));
  const day = parseInt(raw.date.substring(4, 6));

  // Jahr: 00-49 = 2000-2049, 50-99 = 1950-1999
  const fullYear = year < 50 ? 2000 + year : 1900 + year;

  const date = new Date(fullYear, month - 1, day);
  if (isNaN(date.getTime())) return null;

  // Betrag konvertieren
  const amountStr = raw.amount.replace(",", ".");
  let amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;

  // Vorzeichen bestimmen: D = Soll (negativ), C = Haben (positiv)
  // RD = Storno-Soll (positiv), RC = Storno-Haben (negativ)
  if (raw.debitCredit === "D") {
    amount = -Math.abs(amount);
  } else if (raw.debitCredit === "C") {
    amount = Math.abs(amount);
  } else if (raw.debitCredit === "RD") {
    amount = Math.abs(amount); // Storno einer Belastung = Gutschrift
  } else if (raw.debitCredit === "RC") {
    amount = -Math.abs(amount); // Storno einer Gutschrift = Belastung
  }

  return {
    date,
    amount,
    description: raw.description,
    counterpartName: raw.counterpartName,
    counterpartIban: raw.counterpartIban,
  };
}
