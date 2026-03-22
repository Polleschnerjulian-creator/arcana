import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface KassenbuchEntry {
  id: string;
  date: Date;
  reference: string | null;
  description: string;
  debit: number;  // Einnahme (Soll)
  credit: number; // Ausgabe (Haben)
  runningBalance: number;
}

export interface KassenbuchDay {
  date: Date;
  entries: KassenbuchEntry[];
  einnahmen: number;
  ausgaben: number;
}

export interface KassenbuchReport {
  account: { id: string; number: string; name: string };
  period: { from: Date; to: Date };
  openingBalance: number;
  days: KassenbuchDay[];
  closingBalance: number;
  totalEinnahmen: number;
  totalAusgaben: number;
}

// ─── Computation ─────────────────────────────────────────────────

/**
 * Berechnet das Kassenbuch für ein bestimmtes Konto und einen Zeitraum.
 *
 * Das Kassenbuch ist eine gesetzlich vorgeschriebene Aufzeichnung aller
 * Bargeldbewegungen, gruppiert nach Tagen mit laufendem Saldo.
 *
 * Konvention für ASSET-Konten: Soll = Einnahme, Haben = Ausgabe.
 * Anfangssaldo = Summe aller Soll-Haben VOR dem Startdatum.
 */
export async function computeKassenbuch(
  organizationId: string,
  accountId: string,
  from: Date,
  to: Date
): Promise<KassenbuchReport> {
  // Fetch account info
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { id: true, number: true, name: true, type: true },
  });

  // Ensure 'to' includes the full day
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  // ─── Opening Balance ────────────────────────────────────────────
  // Sum all BOOKED debit - credit for this account BEFORE from date
  const priorLines = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { lt: from },
      },
    },
    select: { debit: true, credit: true },
  });

  let openingBalance = 0;
  for (const line of priorLines) {
    // ASSET account: balance = debit - credit
    openingBalance += Number(line.debit) - Number(line.credit);
  }
  openingBalance = roundCurrency(openingBalance);

  // ─── Period Entries ─────────────────────────────────────────────
  const periodLines = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        organizationId,
        status: "BOOKED",
        date: { gte: from, lte: toEnd },
      },
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: {
      transaction: { date: "asc" },
    },
  });

  // Group entries by date
  const dayMap = new Map<string, KassenbuchEntry[]>();

  for (const line of periodLines) {
    const dateKey = new Date(line.transaction.date).toISOString().split("T")[0];

    const entry: KassenbuchEntry = {
      id: line.id,
      date: line.transaction.date,
      reference: line.transaction.reference,
      description: line.transaction.description,
      debit: Number(line.debit),
      credit: Number(line.credit),
      runningBalance: 0, // will be computed below
    };

    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      dayMap.set(dateKey, [entry]);
    }
  }

  // Sort days and compute running balance
  const sortedDateKeys = Array.from(dayMap.keys()).sort();
  const days: KassenbuchDay[] = [];
  let runningBalance = openingBalance;
  let totalEinnahmen = 0;
  let totalAusgaben = 0;

  for (const dateKey of sortedDateKeys) {
    const entries = dayMap.get(dateKey)!;
    let dayEinnahmen = 0;
    let dayAusgaben = 0;

    for (const entry of entries) {
      runningBalance = roundCurrency(runningBalance + entry.debit - entry.credit);
      entry.runningBalance = runningBalance;
      dayEinnahmen += entry.debit;
      dayAusgaben += entry.credit;
    }

    dayEinnahmen = roundCurrency(dayEinnahmen);
    dayAusgaben = roundCurrency(dayAusgaben);
    totalEinnahmen += dayEinnahmen;
    totalAusgaben += dayAusgaben;

    days.push({
      date: new Date(dateKey),
      entries,
      einnahmen: dayEinnahmen,
      ausgaben: dayAusgaben,
    });
  }

  totalEinnahmen = roundCurrency(totalEinnahmen);
  totalAusgaben = roundCurrency(totalAusgaben);
  const closingBalance = roundCurrency(openingBalance + totalEinnahmen - totalAusgaben);

  return {
    account: { id: account.id, number: account.number, name: account.name },
    period: { from, to },
    openingBalance,
    days,
    closingBalance,
    totalEinnahmen,
    totalAusgaben,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
