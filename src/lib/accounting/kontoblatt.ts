import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface KontoblattEntry {
  date: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface KontoblattReport {
  account: {
    number: string;
    name: string;
    type: string;
  };
  period: { from: Date; to: Date };
  openingBalance: number;
  entries: KontoblattEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

// ─── Balance Convention ─────────────────────────────────────────
// ASSET + EXPENSE:  Saldo = Soll - Haben
// LIABILITY + REVENUE + EQUITY: Saldo = Haben - Soll

function computeBalanceDelta(
  accountType: string,
  debit: number,
  credit: number
): number {
  if (accountType === "ASSET" || accountType === "EXPENSE") {
    return roundCurrency(debit - credit);
  }
  // LIABILITY, REVENUE, EQUITY
  return roundCurrency(credit - debit);
}

// ─── Computation ────────────────────────────────────────────────

/**
 * Berechnet das Kontoblatt (Account Ledger) fuer ein einzelnes Konto
 * im gegebenen Zeitraum.
 *
 * Nur BOOKED-Transaktionen werden beruecksichtigt.
 */
export async function computeKontoblatt(
  organizationId: string,
  accountId: string,
  accountType: string,
  from: Date,
  to: Date
): Promise<KontoblattReport> {
  // Ensure 'to' includes the full day
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  // Get account info
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { number: true, name: true, type: true },
  });

  // Query 1: Opening balance — sum debit/credit for this account BEFORE from date
  const openingLines = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        organizationId,
        status: "BOOKED",
        date: {
          lt: from,
        },
      },
    },
    select: {
      debit: true,
      credit: true,
    },
  });

  let openingDebit = 0;
  let openingCredit = 0;
  for (const line of openingLines) {
    openingDebit += Number(line.debit);
    openingCredit += Number(line.credit);
  }

  const openingBalance = computeBalanceDelta(
    accountType,
    roundCurrency(openingDebit),
    roundCurrency(openingCredit)
  );

  // Query 2: Period entries — all BOOKED TransactionLines in date range
  const periodLines = await prisma.transactionLine.findMany({
    where: {
      accountId,
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
      transaction: {
        select: {
          date: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: {
      transaction: {
        date: "asc",
      },
    },
  });

  // Build entries with running balance
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: KontoblattEntry[] = periodLines.map((line) => {
    const debit = roundCurrency(Number(line.debit));
    const credit = roundCurrency(Number(line.credit));
    const delta = computeBalanceDelta(accountType, debit, credit);

    runningBalance = roundCurrency(runningBalance + delta);
    totalDebit = roundCurrency(totalDebit + debit);
    totalCredit = roundCurrency(totalCredit + credit);

    return {
      date: line.transaction.date.toISOString(),
      reference: line.transaction.reference,
      description: line.transaction.description,
      debit,
      credit,
      runningBalance,
    };
  });

  const closingBalance = runningBalance;

  return {
    account: {
      number: account.number,
      name: account.name,
      type: account.type,
    },
    period: { from, to },
    openingBalance,
    entries,
    closingBalance,
    totalDebit,
    totalCredit,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
