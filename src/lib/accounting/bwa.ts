import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface BWARow {
  position: number;
  label: string;
  currentMonth: number;
  yearToDate: number;
  isSubtotal?: boolean;
}

export interface BWAReport {
  period: { year: number; month: number };
  umsatzerloese: number;
  materialaufwand: number;
  rohertrag: number;
  personalkosten: number;
  raumkosten: number;
  sonstigerAufwand: number;
  betriebsergebnis: number;
  zinsertraege: number;
  zinsaufwand: number;
  ergebnisVorSteuern: number;
  rows: BWARow[];
}

// ─── Account Range Helpers ───────────────────────────────────────

interface AccountRange {
  from: number;
  to: number;
}

/**
 * Standard-BWA Positionen und zugehörige SKR03-Kontenbereiche.
 *
 * Die BWA orientiert sich am DATEV-Standard und fasst Konten zu
 * betriebswirtschaftlichen Kennzahlen zusammen.
 */
const BWA_POSITIONS: {
  position: number;
  label: string;
  ranges: AccountRange[];
  type: "REVENUE" | "EXPENSE";
  isSubtotal?: boolean;
}[] = [
  // Position 1: Umsatzerlöse
  {
    position: 1,
    label: "Umsatzerlöse",
    ranges: [{ from: 8100, to: 8519 }],
    type: "REVENUE",
  },
  // Position 2: Bestandsveränderungen / aktivierte Eigenleistungen
  {
    position: 2,
    label: "Bestandsveränderungen",
    ranges: [{ from: 7000, to: 7099 }],
    type: "EXPENSE", // treated as expense since debit increases, credit decreases
  },
  // Position 3: Sonstige betriebliche Erträge
  {
    position: 3,
    label: "Sonstige betriebliche Erträge",
    ranges: [
      { from: 8600, to: 8699 },
      { from: 8700, to: 8799 },
      { from: 8800, to: 8899 },
      { from: 8920, to: 8929 },
    ],
    type: "REVENUE",
  },
  // Position 4: Gesamtleistung (subtotal: 1 + 2 + 3) — computed
  // Position 5: Materialaufwand / Wareneinkauf
  {
    position: 5,
    label: "Materialaufwand / Wareneinkauf",
    ranges: [{ from: 3000, to: 3999 }],
    type: "EXPENSE",
  },
  // Position 6: Rohertrag (subtotal: 4 - 5) — computed
  // Position 7: Personalkosten
  {
    position: 7,
    label: "Personalkosten",
    ranges: [{ from: 4100, to: 4199 }],
    type: "EXPENSE",
  },
  // Position 8: Raumkosten
  {
    position: 8,
    label: "Raumkosten",
    ranges: [{ from: 4200, to: 4299 }],
    type: "EXPENSE",
  },
  // Position 9: Versicherungen / Beiträge
  {
    position: 9,
    label: "Versicherungen / Beiträge",
    ranges: [{ from: 4300, to: 4399 }],
    type: "EXPENSE",
  },
  // Position 10: Kfz-Kosten
  {
    position: 10,
    label: "Kfz-Kosten",
    ranges: [{ from: 4500, to: 4599 }],
    type: "EXPENSE",
  },
  // Position 11: Werbe- und Reisekosten
  {
    position: 11,
    label: "Werbe- und Reisekosten",
    ranges: [{ from: 4600, to: 4699 }],
    type: "EXPENSE",
  },
  // Position 12: Abschreibungen
  {
    position: 12,
    label: "Abschreibungen",
    ranges: [{ from: 4970, to: 4989 }],
    type: "EXPENSE",
  },
  // Position 13: Sonstige betriebliche Aufwendungen
  {
    position: 13,
    label: "Sonstige betriebliche Aufwendungen",
    ranges: [
      { from: 4700, to: 4899 },
      { from: 4900, to: 4969 },
      { from: 4990, to: 4999 },
    ],
    type: "EXPENSE",
  },
  // Position 14: Betriebsergebnis (EBIT) — computed (6 - 7..13)
  // Position 15: Zinserträge
  {
    position: 15,
    label: "Zinserträge",
    ranges: [{ from: 8900, to: 8919 }],
    type: "REVENUE",
  },
  // Position 16: Zinsaufwand
  {
    position: 16,
    label: "Zinsaufwand",
    ranges: [{ from: 2100, to: 2109 }],
    type: "EXPENSE",
  },
];

// ─── Computation ─────────────────────────────────────────────────

/**
 * Berechnet die Betriebswirtschaftliche Auswertung (BWA) im
 * DATEV-Standard-Format.
 *
 * Enthält:
 * - Aktuelle Monatswerte
 * - Kumulierte Werte seit Jahresbeginn (Year-to-Date)
 * - Standard-Positionen 1-20
 */
export async function computeBWA(
  organizationId: string,
  year: number,
  month: number
): Promise<BWAReport> {
  // Get the organization's fiscal year start
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { fiscalYearStart: true },
  });

  // Current month date range
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Year-to-date range (from fiscal year start)
  const fiscalYearStart = org.fiscalYearStart;
  const ytdYear = month >= fiscalYearStart ? year : year - 1;
  const ytdStart = new Date(ytdYear, fiscalYearStart - 1, 1);

  // Fetch account totals for current month
  const monthTotals = await fetchAccountTotals(organizationId, monthStart, monthEnd);

  // Fetch account totals for year-to-date
  const ytdTotals = await fetchAccountTotals(organizationId, ytdStart, monthEnd);

  // Build BWA rows
  const rows: BWARow[] = [];

  // Position 1: Umsatzerlöse
  const umsatz = getPositionDef(1)!;
  const umsatzMonth = sumRanges(umsatz.ranges, monthTotals, umsatz.type);
  const umsatzYTD = sumRanges(umsatz.ranges, ytdTotals, umsatz.type);
  rows.push({ position: 1, label: umsatz.label, currentMonth: umsatzMonth, yearToDate: umsatzYTD });

  // Position 2: Bestandsveränderungen
  const bestand = getPositionDef(2)!;
  const bestandMonth = sumRanges(bestand.ranges, monthTotals, bestand.type);
  const bestandYTD = sumRanges(bestand.ranges, ytdTotals, bestand.type);
  rows.push({ position: 2, label: bestand.label, currentMonth: bestandMonth, yearToDate: bestandYTD });

  // Position 3: Sonstige betriebliche Erträge
  const sonstErtraege = getPositionDef(3)!;
  const sonstErtraegeMonth = sumRanges(sonstErtraege.ranges, monthTotals, sonstErtraege.type);
  const sonstErtraegeYTD = sumRanges(sonstErtraege.ranges, ytdTotals, sonstErtraege.type);
  rows.push({ position: 3, label: sonstErtraege.label, currentMonth: sonstErtraegeMonth, yearToDate: sonstErtraegeYTD });

  // Position 4: Gesamtleistung (subtotal)
  const gesamtleistungMonth = roundCurrency(umsatzMonth - bestandMonth + sonstErtraegeMonth);
  const gesamtleistungYTD = roundCurrency(umsatzYTD - bestandYTD + sonstErtraegeYTD);
  rows.push({ position: 4, label: "Gesamtleistung", currentMonth: gesamtleistungMonth, yearToDate: gesamtleistungYTD, isSubtotal: true });

  // Position 5: Materialaufwand
  const material = getPositionDef(5)!;
  const materialMonth = sumRanges(material.ranges, monthTotals, material.type);
  const materialYTD = sumRanges(material.ranges, ytdTotals, material.type);
  rows.push({ position: 5, label: material.label, currentMonth: materialMonth, yearToDate: materialYTD });

  // Position 6: Rohertrag (subtotal)
  const rohertragMonth = roundCurrency(gesamtleistungMonth - materialMonth);
  const rohertragYTD = roundCurrency(gesamtleistungYTD - materialYTD);
  rows.push({ position: 6, label: "Rohertrag", currentMonth: rohertragMonth, yearToDate: rohertragYTD, isSubtotal: true });

  // Positions 7-13: Operating expenses
  let operatingExpensesMonth = 0;
  let operatingExpensesYTD = 0;

  for (const pos of [7, 8, 9, 10, 11, 12, 13]) {
    const def = getPositionDef(pos)!;
    const mVal = sumRanges(def.ranges, monthTotals, def.type);
    const yVal = sumRanges(def.ranges, ytdTotals, def.type);
    rows.push({ position: pos, label: def.label, currentMonth: mVal, yearToDate: yVal });
    operatingExpensesMonth += mVal;
    operatingExpensesYTD += yVal;
  }

  // Position 14: Betriebsergebnis (EBIT)
  const betriebsergebnisMonth = roundCurrency(rohertragMonth - operatingExpensesMonth);
  const betriebsergebnisYTD = roundCurrency(rohertragYTD - operatingExpensesYTD);
  rows.push({ position: 14, label: "Betriebsergebnis", currentMonth: betriebsergebnisMonth, yearToDate: betriebsergebnisYTD, isSubtotal: true });

  // Position 15: Zinserträge
  const zinsErt = getPositionDef(15)!;
  const zinsErtMonth = sumRanges(zinsErt.ranges, monthTotals, zinsErt.type);
  const zinsErtYTD = sumRanges(zinsErt.ranges, ytdTotals, zinsErt.type);
  rows.push({ position: 15, label: zinsErt.label, currentMonth: zinsErtMonth, yearToDate: zinsErtYTD });

  // Position 16: Zinsaufwand
  const zinsAufw = getPositionDef(16)!;
  const zinsAufwMonth = sumRanges(zinsAufw.ranges, monthTotals, zinsAufw.type);
  const zinsAufwYTD = sumRanges(zinsAufw.ranges, ytdTotals, zinsAufw.type);
  rows.push({ position: 16, label: zinsAufw.label, currentMonth: zinsAufwMonth, yearToDate: zinsAufwYTD });

  // Position 17: Finanzergebnis (subtotal)
  const finanzMonth = roundCurrency(zinsErtMonth - zinsAufwMonth);
  const finanzYTD = roundCurrency(zinsErtYTD - zinsAufwYTD);
  rows.push({ position: 17, label: "Finanzergebnis", currentMonth: finanzMonth, yearToDate: finanzYTD, isSubtotal: true });

  // Position 18: Ergebnis vor Steuern
  const ergebnisMonth = roundCurrency(betriebsergebnisMonth + finanzMonth);
  const ergebnisYTD = roundCurrency(betriebsergebnisYTD + finanzYTD);
  rows.push({ position: 18, label: "Ergebnis vor Steuern", currentMonth: ergebnisMonth, yearToDate: ergebnisYTD, isSubtotal: true });

  // Extract summary values for convenience
  const personalDef = getPositionDef(7)!;
  const raumDef = getPositionDef(8)!;

  return {
    period: { year, month },
    umsatzerloese: umsatzMonth,
    materialaufwand: materialMonth,
    rohertrag: rohertragMonth,
    personalkosten: sumRanges(personalDef.ranges, monthTotals, personalDef.type),
    raumkosten: sumRanges(raumDef.ranges, monthTotals, raumDef.type),
    sonstigerAufwand: roundCurrency(operatingExpensesMonth
      - sumRanges(personalDef.ranges, monthTotals, personalDef.type)
      - sumRanges(raumDef.ranges, monthTotals, raumDef.type)),
    betriebsergebnis: betriebsergebnisMonth,
    zinsertraege: zinsErtMonth,
    zinsaufwand: zinsAufwMonth,
    ergebnisVorSteuern: ergebnisMonth,
    rows,
  };
}

// ─── Data Fetching ───────────────────────────────────────────────

interface AccountTotal {
  number: string;
  type: string;
  debit: number;
  credit: number;
}

async function fetchAccountTotals(
  organizationId: string,
  from: Date,
  to: Date
): Promise<Map<string, AccountTotal>> {
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: from, lte: to },
      },
    },
    include: {
      account: {
        select: { number: true, type: true },
      },
    },
  });

  const totals = new Map<string, AccountTotal>();

  for (const line of lines) {
    const key = line.account.number;
    const existing = totals.get(key);

    if (existing) {
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
    } else {
      totals.set(key, {
        number: line.account.number,
        type: line.account.type,
        debit: Number(line.debit),
        credit: Number(line.credit),
      });
    }
  }

  return totals;
}

// ─── Helpers ─────────────────────────────────────────────────────

function getPositionDef(position: number) {
  return BWA_POSITIONS.find((p) => p.position === position);
}

function sumRanges(
  ranges: AccountRange[],
  totals: Map<string, AccountTotal>,
  type: "REVENUE" | "EXPENSE"
): number {
  let sum = 0;

  totals.forEach((acc) => {
    const num = parseInt(acc.number, 10);
    const inRange = ranges.some((r) => num >= r.from && num <= r.to);

    if (inRange) {
      if (type === "REVENUE") {
        sum += acc.credit - acc.debit;
      } else {
        sum += acc.debit - acc.credit;
      }
    }
  });

  return roundCurrency(sum);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
