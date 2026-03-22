import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface SaldenAccount {
  number: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface SaldenGroup {
  label: string;
  type: string;
  accounts: SaldenAccount[];
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
}

export interface SaldenlisteReport {
  period: { from: Date; to: Date };
  groups: SaldenGroup[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  isBalanced: boolean;
}

// ─── Group Definitions ──────────────────────────────────────────

const GROUP_DEFS: { label: string; types: string[] }[] = [
  { label: "Aktiva", types: ["ASSET"] },
  { label: "Passiva", types: ["LIABILITY"] },
  { label: "Eigenkapital", types: ["EQUITY"] },
  { label: "Erloese", types: ["REVENUE"] },
  { label: "Aufwendungen", types: ["EXPENSE"] },
];

// ─── Balance Convention ─────────────────────────────────────────
// ASSET + EXPENSE:  Saldo = Soll - Haben
// LIABILITY + REVENUE + EQUITY: Saldo = Haben - Soll

function computeBalance(type: string, debit: number, credit: number): number {
  if (type === "ASSET" || type === "EXPENSE") {
    return roundCurrency(debit - credit);
  }
  // LIABILITY, REVENUE, EQUITY
  return roundCurrency(credit - debit);
}

// ─── Computation ────────────────────────────────────────────────

/**
 * Berechnet die Summen- und Saldenliste fuer den gegebenen Zeitraum.
 *
 * Nur BOOKED-Transaktionen werden beruecksichtigt.
 * Konten ohne Aktivitaet werden herausgefiltert.
 */
export async function computeSaldenliste(
  organizationId: string,
  from: Date,
  to: Date
): Promise<SaldenlisteReport> {
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

  // Build groups
  const groups: SaldenGroup[] = [];

  for (const def of GROUP_DEFS) {
    const accounts: SaldenAccount[] = [];

    accountTotals.forEach((acc) => {
      if (!def.types.includes(acc.type)) return;

      const debit = roundCurrency(acc.debit);
      const credit = roundCurrency(acc.credit);

      // Filter out accounts with zero activity
      if (debit === 0 && credit === 0) return;

      const balance = computeBalance(acc.type, debit, credit);

      accounts.push({
        number: acc.number,
        name: acc.name,
        type: acc.type,
        debit,
        credit,
        balance,
      });
    });

    // Sort by account number within group
    accounts.sort((a, b) => a.number.localeCompare(b.number));

    if (accounts.length > 0) {
      const totalDebit = roundCurrency(
        accounts.reduce((sum, a) => sum + a.debit, 0)
      );
      const totalCredit = roundCurrency(
        accounts.reduce((sum, a) => sum + a.credit, 0)
      );
      const totalBalance = roundCurrency(
        accounts.reduce((sum, a) => sum + a.balance, 0)
      );

      groups.push({
        label: def.label,
        type: def.types[0],
        accounts,
        totalDebit,
        totalCredit,
        totalBalance,
      });
    }
  }

  // Grand totals
  const grandTotalDebit = roundCurrency(
    groups.reduce((sum, g) => sum + g.totalDebit, 0)
  );
  const grandTotalCredit = roundCurrency(
    groups.reduce((sum, g) => sum + g.totalCredit, 0)
  );
  const isBalanced = grandTotalDebit === grandTotalCredit;

  return {
    period: { from, to },
    groups,
    grandTotalDebit,
    grandTotalCredit,
    isBalanced,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
