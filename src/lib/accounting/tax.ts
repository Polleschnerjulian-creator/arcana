// ─── Types ───────────────────────────────────────────────────────

export type ChartOfAccounts = "SKR03" | "SKR04";

export interface TaxBreakdown {
  net: number;
  tax: number;
}

export interface GrossBreakdown {
  gross: number;
  tax: number;
}

// ─── Tax Calculation ─────────────────────────────────────────────

/**
 * Berechnet den Nettobetrag und die Steuer aus einem Bruttobetrag.
 *
 * Formel: Netto = Brutto / (1 + Steuersatz/100)
 *         Steuer = Brutto - Netto
 *
 * Kaufmännische Rundung auf 2 Dezimalstellen.
 */
export function calculateNetFromGross(
  gross: number,
  taxRate: number
): TaxBreakdown {
  if (taxRate === 0) {
    return { net: roundCurrency(gross), tax: 0 };
  }

  const net = roundCurrency(gross / (1 + taxRate / 100));
  const tax = roundCurrency(gross - net);

  return { net, tax };
}

/**
 * Berechnet den Bruttobetrag und die Steuer aus einem Nettobetrag.
 *
 * Formel: Steuer = Netto * (Steuersatz / 100)
 *         Brutto = Netto + Steuer
 *
 * Kaufmännische Rundung auf 2 Dezimalstellen.
 */
export function calculateGrossFromNet(
  net: number,
  taxRate: number
): GrossBreakdown {
  if (taxRate === 0) {
    return { gross: roundCurrency(net), tax: 0 };
  }

  const tax = roundCurrency(net * (taxRate / 100));
  const gross = roundCurrency(net + tax);

  return { gross, tax };
}

// ─── SKR Account Mappings ────────────────────────────────────────

/**
 * Vorsteuer-Konten (Eingangsseite — Einkäufe)
 *
 * SKR03:
 *   1571 — Abziehbare Vorsteuer 7%
 *   1576 — Abziehbare Vorsteuer 19%
 *
 * SKR04:
 *   1401 — Abziehbare Vorsteuer 7%
 *   1406 — Abziehbare Vorsteuer 19%
 */
const VORSTEUER_ACCOUNTS: Record<ChartOfAccounts, Record<number, string>> = {
  SKR03: {
    7: "1571",
    19: "1576",
  },
  SKR04: {
    7: "1401",
    19: "1406",
  },
};

/**
 * Umsatzsteuer-Konten (Ausgangsseite — Verkäufe)
 *
 * SKR03:
 *   1771 — Umsatzsteuer 7%
 *   1776 — Umsatzsteuer 19%
 *
 * SKR04:
 *   3801 — Umsatzsteuer 7%
 *   3806 — Umsatzsteuer 19%
 */
const UMSATZSTEUER_ACCOUNTS: Record<
  ChartOfAccounts,
  Record<number, string>
> = {
  SKR03: {
    7: "1771",
    19: "1776",
  },
  SKR04: {
    7: "3801",
    19: "3806",
  },
};

/**
 * Gibt die Vorsteuer-Kontonummer für den gegebenen Steuersatz zurück.
 *
 * @param taxRate - Steuersatz in Prozent (0, 7, oder 19)
 * @param chart - Kontenrahmen (SKR03 oder SKR04)
 * @returns Kontonummer als String
 * @throws Bei ungültigem Steuersatz oder steuerbefreiten Buchungen (0%)
 */
export function getVorsteuerAccount(
  taxRate: number,
  chart: ChartOfAccounts
): string {
  if (taxRate === 0) {
    throw new Error(
      "Für steuerbefreite Buchungen (0%) wird kein Vorsteuerkonto benötigt."
    );
  }

  const account = VORSTEUER_ACCOUNTS[chart]?.[taxRate];
  if (!account) {
    throw new Error(
      `Kein Vorsteuerkonto für Steuersatz ${taxRate}% im ${chart} hinterlegt. ` +
        `Unterstützte Sätze: ${Object.keys(VORSTEUER_ACCOUNTS[chart] || {}).join("%, ")}%.`
    );
  }

  return account;
}

/**
 * Gibt die Umsatzsteuer-Kontonummer für den gegebenen Steuersatz zurück.
 *
 * @param taxRate - Steuersatz in Prozent (0, 7, oder 19)
 * @param chart - Kontenrahmen (SKR03 oder SKR04)
 * @returns Kontonummer als String
 * @throws Bei ungültigem Steuersatz oder steuerbefreiten Buchungen (0%)
 */
export function getUmsatzsteuerAccount(
  taxRate: number,
  chart: ChartOfAccounts
): string {
  if (taxRate === 0) {
    throw new Error(
      "Für steuerbefreite Buchungen (0%) wird kein Umsatzsteuerkonto benötigt."
    );
  }

  const account = UMSATZSTEUER_ACCOUNTS[chart]?.[taxRate];
  if (!account) {
    throw new Error(
      `Kein Umsatzsteuerkonto für Steuersatz ${taxRate}% im ${chart} hinterlegt. ` +
        `Unterstützte Sätze: ${Object.keys(UMSATZSTEUER_ACCOUNTS[chart] || {}).join("%, ")}%.`
    );
  }

  return account;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Kaufmännische Rundung auf 2 Dezimalstellen.
 * Verwendet Math.round für korrekte Rundung bei .5-Fällen.
 */
function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
