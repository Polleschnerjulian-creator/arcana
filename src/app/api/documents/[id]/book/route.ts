import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateDoubleEntry } from "@/lib/accounting/ledger";
import { calculateNetFromGross } from "@/lib/accounting/tax";
import { getVorsteuerAccount } from "@/lib/accounting/tax";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import type { AiExtraction, ChartOfAccounts } from "@/types";

// ─── Default Accounts (SKR03) ───────────────────────────────────

const DEFAULT_ACCOUNTS: Record<ChartOfAccounts, { expense: string; bank: string }> = {
  SKR03: { expense: "4900", bank: "1200" },
  SKR04: { expense: "6300", bank: "1800" },
};

// ─── POST: Buchung aus KI-Extraktion erstellen ──────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Load document with org info
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Dokument nicht gefunden." },
        { status: 404 }
      );
    }

    if (!document.aiExtraction) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Keine KI-Extraktion vorhanden. Bitte zuerst die KI-Analyse starten.",
        },
        { status: 400 }
      );
    }

    // Parse AI extraction
    let extraction: AiExtraction;
    try {
      extraction = JSON.parse(document.aiExtraction);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "KI-Extraktion konnte nicht gelesen werden.",
        },
        { status: 500 }
      );
    }

    if (!extraction.amount || extraction.amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kein gültiger Betrag in der KI-Extraktion. Bitte manuell buchen.",
        },
        { status: 400 }
      );
    }

    // Validate required fields — don't silently fill in defaults
    if (extraction.taxRate == null) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kein Steuersatz in der KI-Extraktion erkannt. Bitte manuell buchen.",
        },
        { status: 400 }
      );
    }

    if (!extraction.vendor) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kein Lieferant in der KI-Extraktion erkannt. Bitte manuell buchen.",
        },
        { status: 400 }
      );
    }

    // Get organization's chart of accounts
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { chartOfAccounts: true },
    });

    const chart = (org?.chartOfAccounts as ChartOfAccounts) || "SKR03";
    const defaults = DEFAULT_ACCOUNTS[chart];

    // Determine amounts
    const grossAmount = extraction.amount;
    const taxRate = extraction.taxRate;
    const { net: netAmount, tax: taxAmount } =
      extraction.netAmount && extraction.taxAmount
        ? { net: extraction.netAmount, tax: extraction.taxAmount }
        : calculateNetFromGross(grossAmount, taxRate);

    // Find the accounts in the organization
    const expenseAccount = await prisma.account.findFirst({
      where: {
        organizationId: session.user.organizationId,
        number: defaults.expense,
      },
    });

    const bankAccount = await prisma.account.findFirst({
      where: {
        organizationId: session.user.organizationId,
        number: defaults.bank,
      },
    });

    if (!expenseAccount || !bankAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Standardkonten (${defaults.expense}, ${defaults.bank}) nicht gefunden. Bitte Kontenrahmen prüfen.`,
        },
        { status: 400 }
      );
    }

    // Build transaction lines
    const lines: {
      accountId: string;
      debit: number;
      credit: number;
      taxRate: number | null;
      taxAccountId: string | null;
      note: string | null;
    }[] = [];

    // Find Vorsteuer account if tax applies
    let vstAccountId: string | null = null;
    if (taxRate > 0 && taxAmount > 0) {
      try {
        const vstNumber = getVorsteuerAccount(taxRate, chart);
        const vstAccount = await prisma.account.findFirst({
          where: {
            organizationId: session.user.organizationId,
            number: vstNumber,
          },
        });
        if (vstAccount) {
          vstAccountId = vstAccount.id;
        }
      } catch {
        // VSt account not found — book without tax split
        console.warn(
          `[Book] Vorsteuerkonto für ${taxRate}% nicht gefunden. Buche ohne Steueraufteilung.`
        );
      }
    }

    // Line 1: Expense account (Soll) — net amount
    lines.push({
      accountId: expenseAccount.id,
      debit: vstAccountId ? netAmount : grossAmount,
      credit: 0,
      taxRate: taxRate > 0 ? taxRate : null,
      taxAccountId: vstAccountId,
      note: extraction.vendor
        ? `${extraction.vendor}${extraction.invoiceNumber ? ` — ${extraction.invoiceNumber}` : ""}`
        : null,
    });

    // Line 2: VSt account (Soll) — tax amount (only if VSt account found)
    if (vstAccountId && taxAmount > 0) {
      lines.push({
        accountId: vstAccountId,
        debit: taxAmount,
        credit: 0,
        taxRate: null,
        taxAccountId: null,
        note: `Vorsteuer ${taxRate}%`,
      });
    }

    // Line 3: Bank account (Haben) — gross amount
    lines.push({
      accountId: bankAccount.id,
      debit: 0,
      credit: grossAmount,
      taxRate: null,
      taxAccountId: null,
      note: null,
    });

    // Validate double-entry before creating
    const validation = validateDoubleEntry(
      lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        taxRate: l.taxRate,
      }))
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Buchung nicht ausgeglichen: ${validation.error}`,
        },
        { status: 400 }
      );
    }

    // Build description
    const description = [
      extraction.vendor,
      extraction.invoiceNumber ? `Nr. ${extraction.invoiceNumber}` : null,
      extraction.invoiceDate
        ? `vom ${new Date(extraction.invoiceDate).toLocaleDateString("de-DE")}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    // Create DRAFT transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          organizationId: session.user.organizationId,
          date: extraction.invoiceDate
            ? new Date(extraction.invoiceDate)
            : new Date(),
          description,
          reference: extraction.invoiceNumber || null,
          documentId: document.id,
          status: "DRAFT",
          source: "AI_SUGGESTED",
          aiConfidence: extraction.confidence,
          lines: {
            create: lines,
          },
        },
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, number: true, name: true },
              },
              taxAccount: {
                select: { id: true, number: true, name: true },
              },
            },
          },
        },
      });

      return created;
    });

    // Audit entry (non-blocking)
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "TRANSACTION",
        entityId: transaction.id,
        newState: {
          source: "AI_SUGGESTED",
          aiConfidence: extraction.confidence,
          documentId: document.id,
          description: transaction.description,
          linesCount: transaction.lines.length,
        },
      });
    } catch {
      // Audit module may not be ready
    }

    // Serialize Decimal fields
    const serialized = {
      ...transaction,
      lines: transaction.lines.map((line) => ({
        ...line,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    };

    return NextResponse.json(
      { success: true, data: serialized },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating booking from AI extraction:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
