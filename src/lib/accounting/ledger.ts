// ─── Types ───────────────────────────────────────────────────────

export interface TransactionLine {
  accountId: string;
  debit: number;
  credit: number;
  taxRate?: number | null;
  taxAccountId?: string | null;
}

export interface DoubleEntryResult {
  valid: boolean;
  error?: string;
}

// ─── Double-Entry Validation ─────────────────────────────────────

/**
 * Validiert die doppelte Buchführung: Summe Soll === Summe Haben.
 *
 * Prüft außerdem:
 * - Mindestens 2 Buchungszeilen
 * - Jede Zeile hat entweder Soll > 0 ODER Haben > 0, nie beides
 * - Alle Beträge sind positiv
 */
export function validateDoubleEntry(
  lines: TransactionLine[]
): DoubleEntryResult {
  if (!lines || lines.length < 2) {
    return {
      valid: false,
      error: "Ein Buchungssatz muss mindestens 2 Buchungszeilen enthalten.",
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Prüfen, dass accountId vorhanden ist
    if (!line.accountId) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Konto-ID ist erforderlich.`,
      };
    }

    // Prüfen, dass Beträge Zahlen sind
    if (typeof line.debit !== "number" || typeof line.credit !== "number") {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Soll und Haben müssen numerische Werte sein.`,
      };
    }

    // Prüfen auf NaN
    if (isNaN(line.debit) || isNaN(line.credit)) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Soll und Haben dürfen nicht NaN sein.`,
      };
    }

    // Prüfen, dass Beträge nicht negativ sind
    if (line.debit < 0) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Soll-Betrag darf nicht negativ sein.`,
      };
    }

    if (line.credit < 0) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Haben-Betrag darf nicht negativ sein.`,
      };
    }

    // Prüfen, dass nicht beide gleichzeitig > 0 sind
    if (line.debit > 0 && line.credit > 0) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Eine Buchungszeile darf nicht gleichzeitig Soll und Haben haben.`,
      };
    }

    // Prüfen, dass mindestens einer > 0 ist
    if (line.debit === 0 && line.credit === 0) {
      return {
        valid: false,
        error: `Zeile ${lineNum}: Entweder Soll oder Haben muss größer als 0 sein.`,
      };
    }
  }

  // Summen berechnen mit kaufmännischer Rundung
  const totalDebit = roundCurrency(
    lines.reduce((sum, line) => sum + line.debit, 0)
  );
  const totalCredit = roundCurrency(
    lines.reduce((sum, line) => sum + line.credit, 0)
  );

  if (totalDebit !== totalCredit) {
    return {
      valid: false,
      error: `Soll und Haben sind nicht ausgeglichen: Soll ${formatCurrency(totalDebit)} ≠ Haben ${formatCurrency(totalCredit)}. Differenz: ${formatCurrency(roundCurrency(Math.abs(totalDebit - totalCredit)))}.`,
    };
  }

  return { valid: true };
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Kaufmännische Rundung auf 2 Dezimalstellen.
 */
function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formatiert einen Betrag als Währungsstring (z.B. "1.234,56 €").
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}
