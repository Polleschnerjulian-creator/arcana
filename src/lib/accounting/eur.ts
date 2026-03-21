import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface EURCategory {
  label: string;
  accountRange: string;
  amount: number;
  accounts: { number: string; name: string; amount: number }[];
}

export interface EURReport {
  period: { from: Date; to: Date };
  einnahmen: EURCategory[];
  ausgaben: EURCategory[];
  summeEinnahmen: number;
  summeAusgaben: number;
  gewinnVerlust: number;
}

// ─── SKR03 Account Range Definitions ─────────────────────────────
// Anlage EÜR categories mapped to SKR03 account ranges

interface CategoryDef {
  label: string;
  accountRange: string;
  from: number;
  to: number;
}

const EINNAHMEN_CATEGORIES: CategoryDef[] = [
  { label: "Umsatzerlöse", accountRange: "8100-8519", from: 8100, to: 8519 },
  { label: "Steuerfreie Umsätze", accountRange: "8200-8299", from: 8200, to: 8299 },
  { label: "Steuerfreie innergemeinschaftliche Lieferungen", accountRange: "8600-8699", from: 8600, to: 8699 },
  { label: "Erlösschmälerungen", accountRange: "8700-8799", from: 8700, to: 8799 },
  { label: "Sonstige Erträge", accountRange: "8800-8899", from: 8800, to: 8899 },
  { label: "Zinserträge", accountRange: "8900-8999", from: 8900, to: 8999 },
];

const AUSGABEN_CATEGORIES: CategoryDef[] = [
  { label: "Wareneinkauf", accountRange: "3000-3999", from: 3000, to: 3999 },
  { label: "Personalkosten", accountRange: "4100-4199", from: 4100, to: 4199 },
  { label: "Raumkosten", accountRange: "4200-4299", from: 4200, to: 4299 },
  { label: "Versicherungen", accountRange: "4300-4399", from: 4300, to: 4399 },
  { label: "Kfz-Kosten", accountRange: "4500-4599", from: 4500, to: 4599 },
  { label: "Werbekosten", accountRange: "4600-4639", from: 4600, to: 4639 },
  { label: "Reisekosten", accountRange: "4660-4699", from: 4660, to: 4699 },
  { label: "Bürokosten", accountRange: "4800-4855", from: 4800, to: 4855 },
  { label: "Telekommunikation", accountRange: "4805-4819", from: 4805, to: 4819 },
  { label: "Beratungskosten", accountRange: "4910-4949", from: 4910, to: 4949 },
  { label: "Abschreibungen", accountRange: "4970-4989", from: 4970, to: 4989 },
  { label: "Sonstige Aufwendungen", accountRange: "4900-4999", from: 4900, to: 4999 },
];

// ─── Computation ─────────────────────────────────────────────────

/**
 * Berechnet die Einnahmenüberschussrechnung (EÜR) für den gegebenen Zeitraum.
 *
 * Ist-Versteuerung / Cash-Basis: Maßgeblich ist das Buchungsdatum
 * (= Zahlungsdatum bei EÜR).
 *
 * Nur BOOKED-Transaktionen werden berücksichtigt.
 */
export async function computeEUR(
  organizationId: string,
  from: Date,
  to: Date
): Promise<EURReport> {
  // Ensure 'to' includes the full day
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  // Fetch all BOOKED transaction lines in the date range with their accounts
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: {
          gte: from,
          lte: toEnd,
        },
      },
    },
    include: {
      account: {
        select: {
          number: true,
          name: true,
          type: true,
        },
      },
    },
  });

  // Aggregate amounts per account
  const accountTotals = new Map<
    string,
    { number: string; name: string; type: string; debit: number; credit: number }
  >();

  for (const line of lines) {
    const key = line.account.number;
    const existing = accountTotals.get(key);

    if (existing) {
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
    } else {
      accountTotals.set(key, {
        number: line.account.number,
        name: line.account.name,
        type: line.account.type,
        debit: Number(line.debit),
        credit: Number(line.credit),
      });
    }
  }

  // Build revenue categories (Einnahmen)
  // For REVENUE accounts: net amount = credit - debit
  const einnahmen = buildCategories(EINNAHMEN_CATEGORIES, accountTotals, "REVENUE");

  // Build expense categories (Ausgaben)
  // For EXPENSE accounts: net amount = debit - credit
  const ausgaben = buildCategories(AUSGABEN_CATEGORIES, accountTotals, "EXPENSE");

  const summeEinnahmen = roundCurrency(
    einnahmen.reduce((sum, cat) => sum + cat.amount, 0)
  );
  const summeAusgaben = roundCurrency(
    ausgaben.reduce((sum, cat) => sum + cat.amount, 0)
  );
  const gewinnVerlust = roundCurrency(summeEinnahmen - summeAusgaben);

  return {
    period: { from, to },
    einnahmen,
    ausgaben,
    summeEinnahmen,
    summeAusgaben,
    gewinnVerlust,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildCategories(
  categoryDefs: CategoryDef[],
  accountTotals: Map<string, { number: string; name: string; type: string; debit: number; credit: number }>,
  accountType: "REVENUE" | "EXPENSE"
): EURCategory[] {
  // Track which accounts have been assigned to avoid double-counting
  // in overlapping ranges (e.g. Sonstige Aufwendungen 4900-4999 overlaps
  // with Beratungskosten 4910-4949). More specific ranges take priority
  // because they appear first in the array.
  const assignedAccounts = new Set<string>();

  const categories: EURCategory[] = [];

  for (const def of categoryDefs) {
    const matchingAccounts: { number: string; name: string; amount: number }[] = [];

    accountTotals.forEach((acc) => {
      if (acc.type !== accountType) return;

      const num = parseInt(acc.number, 10);
      if (num >= def.from && num <= def.to && !assignedAccounts.has(acc.number)) {
        const amount =
          accountType === "REVENUE"
            ? roundCurrency(acc.credit - acc.debit)
            : roundCurrency(acc.debit - acc.credit);

        if (amount !== 0) {
          matchingAccounts.push({
            number: acc.number,
            name: acc.name,
            amount,
          });
          assignedAccounts.add(acc.number);
        }
      }
    });

    // Sort accounts by number
    matchingAccounts.sort((a, b) => a.number.localeCompare(b.number));

    const totalAmount = roundCurrency(
      matchingAccounts.reduce((sum, a) => sum + a.amount, 0)
    );

    // Only include categories that have data
    if (matchingAccounts.length > 0) {
      categories.push({
        label: def.label,
        accountRange: def.accountRange,
        amount: totalAmount,
        accounts: matchingAccounts,
      });
    }
  }

  return categories;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
