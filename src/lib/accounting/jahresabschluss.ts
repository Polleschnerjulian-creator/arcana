// ─── Jahresabschluss (Year-End Closing) ─────────────────────────
//
// Abschluss der Erfolgskonten (Aufwand + Ertrag) und Uebertragung
// des Jahresergebnisses auf Gewinnvortrag / Verlustvortrag.
//
// IRREVERSIBEL: Einmal durchgefuehrt, kann der Jahresabschluss
// nicht rueckgaengig gemacht werden.

import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Types ───────────────────────────────────────────────────────

export interface AccountBalance {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  debitTotal: number;
  creditTotal: number;
  balance: number; // Positive = typical for that account type
}

export interface JahresabschlussPreview {
  fiscalYear: number;
  revenueAccounts: AccountBalance[];
  expenseAccounts: AccountBalance[];
  revenueTotal: number;
  expenseTotal: number;
  netIncome: number; // Positive = Gewinn, Negative = Verlust
  alreadyClosed: boolean;
}

export interface JahresabschlussResult {
  netIncome: number;
  closingTransactions: string[];
  revenueTotal: number;
  expenseTotal: number;
}

// ─── Preview ────────────────────────────────────────────────────

/**
 * Erstellt eine Vorschau des Jahresabschlusses ohne Buchungen.
 * Zeigt alle Erfolgskonten mit Salden und das Jahresergebnis.
 */
export async function previewJahresabschluss(
  organizationId: string,
  fiscalYear: number
): Promise<JahresabschlussPreview> {
  const { periodStart, periodEnd } = getFiscalYearDates(
    organizationId,
    fiscalYear
  );

  // Check if already closed
  const alreadyClosed = await checkAlreadyClosed(
    organizationId,
    fiscalYear
  );

  // Get all account balances for revenue and expense accounts
  const revenueAccounts = await getAccountBalances(
    organizationId,
    "REVENUE",
    periodStart,
    periodEnd
  );

  const expenseAccounts = await getAccountBalances(
    organizationId,
    "EXPENSE",
    periodStart,
    periodEnd
  );

  const revenueTotal = roundCurrency(
    revenueAccounts.reduce((sum, a) => sum + a.balance, 0)
  );
  const expenseTotal = roundCurrency(
    expenseAccounts.reduce((sum, a) => sum + a.balance, 0)
  );
  const netIncome = roundCurrency(revenueTotal - expenseTotal);

  return {
    fiscalYear,
    revenueAccounts,
    expenseAccounts,
    revenueTotal,
    expenseTotal,
    netIncome,
    alreadyClosed,
  };
}

// ─── Execute ────────────────────────────────────────────────────

/**
 * Fuehrt den Jahresabschluss durch:
 * 1. Verifiziert, dass kein Abschluss fuer dieses Jahr existiert
 * 2. Schliesst alle Erloeskonten (Soll an GuV-Konto)
 * 3. Schliesst alle Aufwandskonten (GuV-Konto an Haben)
 * 4. Uebertraegt Ergebnis auf Gewinnvortrag/Verlustvortrag
 * 5. Erstellt Audit-Eintraege
 */
export async function performJahresabschluss(
  organizationId: string,
  fiscalYear: number,
  userId: string
): Promise<JahresabschlussResult> {
  const { periodStart, periodEnd } = getFiscalYearDates(
    organizationId,
    fiscalYear
  );

  // 1. Check if already closed
  const alreadyClosed = await checkAlreadyClosed(organizationId, fiscalYear);
  if (alreadyClosed) {
    throw new Error(
      `Jahresabschluss fuer ${fiscalYear} wurde bereits durchgefuehrt.`
    );
  }

  // 2. Get account balances
  const revenueAccounts = await getAccountBalances(
    organizationId,
    "REVENUE",
    periodStart,
    periodEnd
  );
  const expenseAccounts = await getAccountBalances(
    organizationId,
    "EXPENSE",
    periodStart,
    periodEnd
  );

  const revenueTotal = roundCurrency(
    revenueAccounts.reduce((sum, a) => sum + a.balance, 0)
  );
  const expenseTotal = roundCurrency(
    expenseAccounts.reduce((sum, a) => sum + a.balance, 0)
  );
  const netIncome = roundCurrency(revenueTotal - expenseTotal);

  // 3. Find or ensure the necessary closing accounts exist
  // GuV-Sammelkonto: 2000 Eigenkapital (used as intermediary)
  // Gewinnvortrag: 2970 (Gewinnvortrag vor Verwendung)
  // Verlustvortrag: 2978 (Verlustvortrag vor Verwendung)
  const guvAccountNumber = "2000";
  const gewinnvortragNumber = netIncome >= 0 ? "2970" : "2978";

  const guvAccount = await findOrCreateAccount(
    organizationId,
    guvAccountNumber,
    guvAccountNumber === "2000" ? "Eigenkapital" : "GuV-Konto",
    "EQUITY"
  );

  const ergebnisAccount = await findOrCreateAccount(
    organizationId,
    gewinnvortragNumber,
    netIncome >= 0
      ? "Gewinnvortrag vor Verwendung"
      : "Verlustvortrag vor Verwendung",
    "EQUITY"
  );

  // 4. Create closing transactions in a single Prisma transaction
  const closingDate = periodEnd;
  const closingTransactionIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Close each REVENUE account: Debit Revenue, Credit GuV
    for (const account of revenueAccounts) {
      if (account.balance === 0) continue;

      const txn = await tx.transaction.create({
        data: {
          organizationId,
          date: closingDate,
          description: `Jahresabschluss ${fiscalYear}: Abschluss ${account.accountNumber} ${account.accountName}`,
          reference: `JA-${fiscalYear}-${account.accountNumber}`,
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: userId,
          source: "MANUAL",
          lines: {
            create: [
              {
                accountId: account.accountId,
                debit: account.balance, // Debit to close revenue (normally credit balance)
                credit: 0,
              },
              {
                accountId: guvAccount.id,
                debit: 0,
                credit: account.balance, // Credit to GuV
              },
            ],
          },
        },
      });
      closingTransactionIds.push(txn.id);
    }

    // Close each EXPENSE account: Debit GuV, Credit Expense
    for (const account of expenseAccounts) {
      if (account.balance === 0) continue;

      const txn = await tx.transaction.create({
        data: {
          organizationId,
          date: closingDate,
          description: `Jahresabschluss ${fiscalYear}: Abschluss ${account.accountNumber} ${account.accountName}`,
          reference: `JA-${fiscalYear}-${account.accountNumber}`,
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: userId,
          source: "MANUAL",
          lines: {
            create: [
              {
                accountId: guvAccount.id,
                debit: account.balance, // Debit GuV
                credit: 0,
              },
              {
                accountId: account.accountId,
                debit: 0,
                credit: account.balance, // Credit to close expense (normally debit balance)
              },
            ],
          },
        },
      });
      closingTransactionIds.push(txn.id);
    }

    // Transfer net income to Gewinnvortrag/Verlustvortrag
    if (netIncome !== 0) {
      const absIncome = Math.abs(netIncome);
      const txn = await tx.transaction.create({
        data: {
          organizationId,
          date: closingDate,
          description: `Jahresabschluss ${fiscalYear}: ${
            netIncome >= 0
              ? "Jahresueberschuss"
              : "Jahresfehlbetrag"
          } ${formatCurrency(absIncome)}`,
          reference: `JA-${fiscalYear}-ERGEBNIS`,
          status: "BOOKED",
          bookedAt: new Date(),
          bookedById: userId,
          source: "MANUAL",
          lines: {
            create:
              netIncome >= 0
                ? [
                    // Gewinn: Debit GuV, Credit Gewinnvortrag
                    {
                      accountId: guvAccount.id,
                      debit: absIncome,
                      credit: 0,
                    },
                    {
                      accountId: ergebnisAccount.id,
                      debit: 0,
                      credit: absIncome,
                    },
                  ]
                : [
                    // Verlust: Debit Verlustvortrag, Credit GuV
                    {
                      accountId: ergebnisAccount.id,
                      debit: absIncome,
                      credit: 0,
                    },
                    {
                      accountId: guvAccount.id,
                      debit: 0,
                      credit: absIncome,
                    },
                  ],
          },
        },
      });
      closingTransactionIds.push(txn.id);
    }
  });

  // 5. Audit entries
  try {
    await createAuditEntry({
      organizationId,
      userId,
      action: "CREATE",
      entityType: "TRANSACTION",
      entityId: closingTransactionIds[0] || "JAHRESABSCHLUSS",
      newState: {
        type: "JAHRESABSCHLUSS",
        fiscalYear,
        netIncome,
        revenueTotal,
        expenseTotal,
        closingTransactionCount: closingTransactionIds.length,
        closingTransactionIds,
      },
    });
  } catch {
    // Audit is non-blocking
  }

  return {
    netIncome,
    closingTransactions: closingTransactionIds,
    revenueTotal,
    expenseTotal,
  };
}

// ─── Helper: Get Account Balances ───────────────────────────────

async function getAccountBalances(
  organizationId: string,
  accountType: string,
  periodStart: Date,
  periodEnd: Date
): Promise<AccountBalance[]> {
  const periodEndFull = new Date(periodEnd);
  periodEndFull.setHours(23, 59, 59, 999);

  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: {
        organizationId,
        status: "BOOKED",
        date: {
          gte: periodStart,
          lte: periodEndFull,
        },
      },
      account: {
        type: accountType,
      },
    },
    include: {
      account: {
        select: {
          id: true,
          number: true,
          name: true,
          type: true,
        },
      },
    },
  });

  // Aggregate per account
  const balanceMap = new Map<string, AccountBalance>();

  for (const line of lines) {
    const key = line.account.id;
    const existing = balanceMap.get(key);

    if (existing) {
      existing.debitTotal += Number(line.debit);
      existing.creditTotal += Number(line.credit);
    } else {
      balanceMap.set(key, {
        accountId: line.account.id,
        accountNumber: line.account.number,
        accountName: line.account.name,
        accountType: line.account.type,
        debitTotal: Number(line.debit),
        creditTotal: Number(line.credit),
        balance: 0,
      });
    }
  }

  // Compute balance based on account type convention
  const accounts: AccountBalance[] = [];
  for (const acc of Array.from(balanceMap.values())) {
    if (accountType === "REVENUE") {
      // Revenue: normally credit balance (Haben-Saldo)
      acc.balance = roundCurrency(acc.creditTotal - acc.debitTotal);
    } else {
      // Expense: normally debit balance (Soll-Saldo)
      acc.balance = roundCurrency(acc.debitTotal - acc.creditTotal);
    }

    // Skip zero-balance accounts
    if (Math.abs(acc.balance) >= 0.01) {
      acc.debitTotal = roundCurrency(acc.debitTotal);
      acc.creditTotal = roundCurrency(acc.creditTotal);
      accounts.push(acc);
    }
  }

  accounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  return accounts;
}

// ─── Helper: Check Already Closed ───────────────────────────────

async function checkAlreadyClosed(
  organizationId: string,
  fiscalYear: number
): Promise<boolean> {
  const existingClosing = await prisma.transaction.findFirst({
    where: {
      organizationId,
      reference: `JA-${fiscalYear}-ERGEBNIS`,
      status: "BOOKED",
    },
  });

  return !!existingClosing;
}

// ─── Helper: Find or Create Account ─────────────────────────────

async function findOrCreateAccount(
  organizationId: string,
  number: string,
  name: string,
  type: string
) {
  let account = await prisma.account.findFirst({
    where: { organizationId, number },
  });

  if (!account) {
    account = await prisma.account.create({
      data: {
        organizationId,
        number,
        name,
        type,
        category: "EIGENKAPITAL",
        isSystem: true,
        isActive: true,
      },
    });
  }

  return account;
}

// ─── Helper: Fiscal Year Dates ──────────────────────────────────

function getFiscalYearDates(
  _organizationId: string,
  fiscalYear: number
): { periodStart: Date; periodEnd: Date } {
  // Standard: Jan 1 - Dec 31
  // In future: respect org's fiscalYearStart setting
  const periodStart = new Date(fiscalYear, 0, 1);
  const periodEnd = new Date(fiscalYear, 11, 31);
  return { periodStart, periodEnd };
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " EUR";
}
