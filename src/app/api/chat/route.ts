import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFinancialSummary } from "@/lib/ai/financial-summary";
import Anthropic from "@anthropic-ai/sdk";

// ─── Quick Command Handlers ──────────────────────────────────────
// For common queries, skip the AI and query the database directly.

async function handleOpenInvoices(orgId: string): Promise<string | null> {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["SENT", "OVERDUE"] },
    },
    orderBy: { dueDate: "asc" },
    select: {
      invoiceNumber: true,
      customerName: true,
      total: true,
      status: true,
      dueDate: true,
    },
  });

  if (invoices.length === 0) {
    return "Es gibt aktuell keine offenen Rechnungen. Alles bezahlt!";
  }

  const lines = invoices.map((inv) => {
    const total = formatEur(Number(inv.total));
    const due = formatDate(inv.dueDate);
    const statusLabel = inv.status === "OVERDUE" ? " (UEBERFAELLIG)" : "";
    return `- ${inv.invoiceNumber}: ${inv.customerName} -- ${total} -- faellig ${due}${statusLabel}`;
  });

  const totalSum = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  return `Offene Rechnungen (${invoices.length}):\n\n${lines.join("\n")}\n\nGesamt: ${formatEur(totalSum)}`;
}

async function handleRecentTransactions(orgId: string): Promise<string | null> {
  const transactions = await prisma.transaction.findMany({
    where: { organizationId: orgId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10,
    include: {
      lines: {
        include: {
          account: { select: { type: true, name: true } },
        },
      },
    },
  });

  if (transactions.length === 0) {
    return "Es gibt noch keine Buchungen.";
  }

  const lines = transactions.map((tx) => {
    const date = formatDate(tx.date);
    // Calculate the primary amount from lines
    let amount = 0;
    for (const line of tx.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (line.account.type === "REVENUE") {
        amount += credit - debit;
      } else if (line.account.type === "EXPENSE") {
        amount -= debit - credit;
      }
    }
    // If no revenue/expense lines found, use first line's max value
    if (amount === 0 && tx.lines.length > 0) {
      const firstLine = tx.lines[0];
      amount = Math.max(Number(firstLine.debit), Number(firstLine.credit));
    }
    const statusLabel = tx.status === "DRAFT" ? " [Entwurf]" : tx.status === "CANCELLED" ? " [Storniert]" : "";
    return `- ${date}: ${tx.description} -- ${formatEur(amount)}${statusLabel}`;
  });

  return `Letzte ${transactions.length} Buchungen:\n\n${lines.join("\n")}`;
}

async function handleRevenue(orgId: string): Promise<string | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(now);

  // Get revenue lines for month and year
  const [monthLines, yearLines] = await Promise.all([
    prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId: orgId,
          status: "BOOKED",
          date: { gte: monthStart, lte: monthEnd },
        },
        account: { type: "REVENUE" },
      },
    }),
    prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId: orgId,
          status: "BOOKED",
          date: { gte: yearStart, lte: yearEnd },
        },
        account: { type: "REVENUE" },
      },
    }),
  ]);

  const monthRevenue = monthLines.reduce((sum, l) => sum + Number(l.credit) - Number(l.debit), 0);
  const yearRevenue = yearLines.reduce((sum, l) => sum + Number(l.credit) - Number(l.debit), 0);

  return `Umsatz:\n\n- ${monthLabel}: ${formatEur(monthRevenue)}\n- Gesamt ${now.getFullYear()}: ${formatEur(yearRevenue)}`;
}

// ─── Pattern Matching for Quick Commands ─────────────────────────

interface QuickCommand {
  patterns: RegExp[];
  handler: (orgId: string) => Promise<string | null>;
}

const quickCommands: QuickCommand[] = [
  {
    patterns: [
      /^offene\s*rechnungen$/i,
      /^was\s*(sind|ist)\s*(meine\s*)?offene(n)?\s*rechnungen/i,
      /^zeig\s*(mir\s*)?(die\s*)?offene(n)?\s*rechnungen/i,
      /offene(n)?\s*rechnungen\s*anzeigen/i,
    ],
    handler: handleOpenInvoices,
  },
  {
    patterns: [
      /^letzte\s*buchungen$/i,
      /^zeig\s*(mir\s*)?(die\s*)?letzten\s*\d*\s*buchungen/i,
      /^letzte(n)?\s*\d*\s*buchungen\s*(anzeigen|zeigen)?$/i,
    ],
    handler: handleRecentTransactions,
  },
  {
    patterns: [
      /^umsatz$/i,
      /^(wie\s*(hoch|viel)\s*(ist|war)\s*(mein|der)\s*)?umsatz/i,
      /^umsatz\s*(diesen?\s*monat|dieses?\s*jahr)?$/i,
    ],
    handler: handleRevenue,
  },
];

function matchQuickCommand(message: string): QuickCommand | null {
  const trimmed = message.trim();
  for (const cmd of quickCommands) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(trimmed)) {
        return cmd;
      }
    }
  }
  return null;
}

// ─── Formatting Helpers ──────────────────────────────────────────

function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// ─── System Prompt ───────────────────────────────────────────────

function buildSystemPrompt(summaryJson: string): string {
  return `Du bist ARCANA, ein intelligenter KI-Assistent fuer Buchhaltung und Finanzen. Du hilfst Nutzern einer deutschen Buchhaltungsplattform, ihre Finanzen zu verstehen und zu verwalten.

## Deine Persoenlichkeit
- Professionell, aber freundlich
- Praezise und datengetrieben
- Du antwortest immer auf Deutsch
- Du fasst dich kurz und praegnant (max. 3-4 Saetze, ausser der Nutzer fragt nach Details)
- Du formatierst Geldbetraege immer als Euro-Werte (z.B. 1.234,56 EUR)

## Verfuegbare Finanzdaten
Die folgenden Daten sind die aktuellen Echtzeitdaten des Unternehmens:

${summaryJson}

## Regeln
1. Beantworte Fragen NUR basierend auf den bereitgestellten Daten
2. Wenn du eine Frage nicht beantworten kannst, sage das ehrlich
3. Erfinde KEINE Zahlen oder Daten
4. Wenn der Nutzer nach etwas fragt, das nicht in den Daten enthalten ist, empfiehl ihm den passenden Bereich in ARCANA (z.B. "Schau dir den Bereich Berichte > EUeR an")
5. Formatiere Listen uebersichtlich
6. Verwende keine Markdown-Formatierung (kein **, kein #, kein \`code\`), da die Antwort in einer Chat-Oberflaeche angezeigt wird
7. Bei Steuerfragen weise darauf hin, dass du kein Steuerberater bist und dies keine Steuerberatung darstellt`;
}

// ─── POST Handler ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const message = body?.message;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Nachricht darf nicht leer sein." },
        { status: 400 }
      );
    }

    if (message.trim().length > 2000) {
      return NextResponse.json(
        { success: false, error: "Nachricht ist zu lang (max. 2000 Zeichen)." },
        { status: 400 }
      );
    }

    const orgId = session.user.organizationId;

    // Check for quick commands first (no AI API cost)
    const quickCommand = matchQuickCommand(message);
    if (quickCommand) {
      const answer = await quickCommand.handler(orgId);
      if (answer) {
        return NextResponse.json({ success: true, answer });
      }
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "KI-Assistent nicht verfuegbar. ANTHROPIC_API_KEY erforderlich.",
        },
        { status: 503 }
      );
    }

    // Fetch financial summary for context
    const summary = await getFinancialSummary(orgId);
    const summaryJson = JSON.stringify(summary, null, 2);

    // Call Claude API
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: buildSystemPrompt(summaryJson),
      messages: [{ role: "user", content: message.trim() }],
    });

    // Extract text response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: "Keine Antwort vom KI-Assistenten erhalten." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      answer: textBlock.text.trim(),
    });
  } catch (error) {
    console.error("[Chat API] Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
