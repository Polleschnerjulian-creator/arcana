import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AiExtraction } from "@/types";

// ─── Inbox Item Type ──────────────────────────────────────────────

export interface InboxItem {
  id: string;
  type: "DOCUMENT" | "BANK_TRANSACTION" | "INVOICE_DRAFT" | "EMAIL_IMPORT";
  source: string;
  title: string;
  subtitle: string;
  amount: number | null;
  date: string;
  status: "PENDING" | "READY" | "ACTION_NEEDED";
  linkedDocumentId: string | null;
  linkedTransactionId: string | null;
  linkedBankTransactionId: string | null;
  aiSuggestion: {
    vendor?: string;
    amount?: number;
    taxRate?: number;
    confidence?: number;
    debitAccount?: string;
    creditAccount?: string;
  } | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseAiExtraction(raw: string | null): AiExtraction | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiExtraction;
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INCOMING_INVOICE: "Eingangsrechnung",
  OUTGOING_INVOICE: "Ausgangsrechnung",
  RECEIPT: "Quittung",
  BANK_STATEMENT: "Kontoauszug",
  OTHER: "Beleg",
};

// ─── GET: Unified Inbox ───────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const orgId = session.user.organizationId;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const items: InboxItem[] = [];

    // ─── Source 1: Documents with DRAFT transactions (READY) ────
    const docsWithDrafts = await prisma.document.findMany({
      where: {
        organizationId: orgId,
        ocrStatus: "DONE",
        transactions: {
          some: { status: "DRAFT" },
        },
      },
      include: {
        transactions: {
          where: { status: "DRAFT" },
          take: 1,
          include: {
            lines: {
              include: {
                account: { select: { number: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    for (const doc of docsWithDrafts) {
      const extraction = parseAiExtraction(doc.aiExtraction);
      const draftTx = doc.transactions[0];
      const debitLine = draftTx?.lines.find((l) => Number(l.debit) > 0);
      const creditLine = draftTx?.lines.find((l) => Number(l.credit) > 0);

      items.push({
        id: `doc-${doc.id}`,
        type: "DOCUMENT",
        source: "upload",
        title: extraction?.vendor || doc.fileName,
        subtitle: `${DOC_TYPE_LABELS[doc.type] || doc.type} · ${formatFileSize(doc.fileSize)}`,
        amount: extraction?.amount ?? null,
        date: (draftTx?.date ?? doc.uploadedAt).toISOString(),
        status: "READY",
        linkedDocumentId: doc.id,
        linkedTransactionId: draftTx?.id ?? null,
        linkedBankTransactionId: null,
        aiSuggestion: extraction
          ? {
              vendor: extraction.vendor,
              amount: extraction.amount,
              taxRate: extraction.taxRate,
              confidence: extraction.confidence,
              debitAccount: debitLine
                ? `${debitLine.account.number} ${debitLine.account.name}`
                : undefined,
              creditAccount: creditLine
                ? `${creditLine.account.number} ${creditLine.account.name}`
                : undefined,
            }
          : null,
        createdAt: doc.uploadedAt.toISOString(),
      });
    }

    // ─── Source 2: Documents still processing (PENDING) ─────────
    const processingDocs = await prisma.document.findMany({
      where: {
        organizationId: orgId,
        ocrStatus: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { uploadedAt: "desc" },
    });

    for (const doc of processingDocs) {
      items.push({
        id: `doc-${doc.id}`,
        type: "DOCUMENT",
        source: "upload",
        title: doc.fileName,
        subtitle: `${DOC_TYPE_LABELS[doc.type] || doc.type} · ${formatFileSize(doc.fileSize)}`,
        amount: null,
        date: doc.uploadedAt.toISOString(),
        status: "PENDING",
        linkedDocumentId: doc.id,
        linkedTransactionId: null,
        linkedBankTransactionId: null,
        aiSuggestion: null,
        createdAt: doc.uploadedAt.toISOString(),
      });
    }

    // ─── Source 3: Documents where pipeline failed (ACTION_NEEDED)
    const failedDocs = await prisma.document.findMany({
      where: {
        organizationId: orgId,
        ocrStatus: "FAILED",
        transactions: { none: { status: "BOOKED" } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    for (const doc of failedDocs) {
      items.push({
        id: `doc-${doc.id}`,
        type: "DOCUMENT",
        source: "upload",
        title: doc.fileName,
        subtitle: `OCR fehlgeschlagen · ${formatFileSize(doc.fileSize)}`,
        amount: null,
        date: doc.uploadedAt.toISOString(),
        status: "ACTION_NEEDED",
        linkedDocumentId: doc.id,
        linkedTransactionId: null,
        linkedBankTransactionId: null,
        aiSuggestion: null,
        createdAt: doc.uploadedAt.toISOString(),
      });
    }

    // ─── Source 4: Unmatched bank transactions (ACTION_NEEDED) ──
    const unmatchedBankTxs = await prisma.bankTransaction.findMany({
      where: {
        matchStatus: "UNMATCHED",
        bankAccount: { organizationId: orgId },
      },
      include: {
        bankAccount: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    for (const btx of unmatchedBankTxs) {
      const amount = Number(btx.amount);
      items.push({
        id: `btx-${btx.id}`,
        type: "BANK_TRANSACTION",
        source: "bank_import",
        title:
          btx.counterpartName ||
          btx.description ||
          `Bankumsatz: ${amount >= 0 ? "+" : ""}${amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR`,
        subtitle: `${btx.bankAccount.name} · ${new Date(btx.date).toLocaleDateString("de-DE")}`,
        amount,
        date: btx.date.toISOString(),
        status: "ACTION_NEEDED",
        linkedDocumentId: null,
        linkedTransactionId: null,
        linkedBankTransactionId: btx.id,
        aiSuggestion: null,
        createdAt: btx.createdAt.toISOString(),
      });
    }

    // ─── Source 5: AI-suggested bank matches (READY) ────────────
    const suggestedBankTxs = await prisma.bankTransaction.findMany({
      where: {
        matchStatus: "AI_SUGGESTED",
        bankAccount: { organizationId: orgId },
      },
      include: {
        bankAccount: { select: { name: true } },
        matchedTransaction: {
          select: {
            id: true,
            description: true,
            document: { select: { id: true } },
            lines: {
              include: {
                account: { select: { number: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    for (const btx of suggestedBankTxs) {
      const amount = Number(btx.amount);
      const matchedTx = btx.matchedTransaction;
      const debitLine = matchedTx?.lines.find((l) => Number(l.debit) > 0);
      const creditLine = matchedTx?.lines.find((l) => Number(l.credit) > 0);

      items.push({
        id: `btx-${btx.id}`,
        type: "BANK_TRANSACTION",
        source: "bank_import",
        title:
          btx.counterpartName ||
          btx.description ||
          `Bankumsatz: ${amount >= 0 ? "+" : ""}${amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR`,
        subtitle: `${btx.bankAccount.name} · ${new Date(btx.date).toLocaleDateString("de-DE")} · KI-Vorschlag`,
        amount,
        date: btx.date.toISOString(),
        status: "READY",
        linkedDocumentId: matchedTx?.document?.id ?? null,
        linkedTransactionId: matchedTx?.id ?? null,
        linkedBankTransactionId: btx.id,
        aiSuggestion: {
          confidence: btx.matchConfidence ?? undefined,
          debitAccount: debitLine
            ? `${debitLine.account.number} ${debitLine.account.name}`
            : undefined,
          creditAccount: creditLine
            ? `${creditLine.account.number} ${creditLine.account.name}`
            : undefined,
        },
        createdAt: btx.createdAt.toISOString(),
      });
    }

    // ─── Source 6: Draft transactions from email/webhook imports ─
    const emailDrafts = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        status: "DRAFT",
        source: "API",
      },
      include: {
        document: { select: { id: true, fileName: true, type: true } },
        lines: {
          include: {
            account: { select: { number: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    for (const tx of emailDrafts) {
      // Skip if already added via document source
      if (tx.documentId && items.some((i) => i.linkedDocumentId === tx.documentId)) {
        continue;
      }

      const debitLine = tx.lines.find((l) => Number(l.debit) > 0);
      const creditLine = tx.lines.find((l) => Number(l.credit) > 0);
      const totalAmount = tx.lines.reduce(
        (sum, l) => sum + Number(l.debit),
        0
      );

      items.push({
        id: `tx-${tx.id}`,
        type: "EMAIL_IMPORT",
        source: "email",
        title: tx.description,
        subtitle: `E-Mail-Import · ${new Date(tx.date).toLocaleDateString("de-DE")}`,
        amount: totalAmount,
        date: tx.date.toISOString(),
        status: "READY",
        linkedDocumentId: tx.documentId,
        linkedTransactionId: tx.id,
        linkedBankTransactionId: null,
        aiSuggestion: {
          confidence: tx.aiConfidence ?? undefined,
          debitAccount: debitLine
            ? `${debitLine.account.number} ${debitLine.account.name}`
            : undefined,
          creditAccount: creditLine
            ? `${creditLine.account.number} ${creditLine.account.name}`
            : undefined,
        },
        createdAt: tx.createdAt.toISOString(),
      });
    }

    // ─── Filter by status ───────────────────────────────────────
    let filtered = items;
    if (statusFilter) {
      filtered = items.filter((item) => item.status === statusFilter);
    }

    // ─── Sort by date descending ────────────────────────────────
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // ─── Limit ──────────────────────────────────────────────────
    const limited = filtered.slice(0, limit);

    // ─── Counts per status ──────────────────────────────────────
    const counts = {
      total: items.length,
      ready: items.filter((i) => i.status === "READY").length,
      actionNeeded: items.filter((i) => i.status === "ACTION_NEEDED").length,
      pending: items.filter((i) => i.status === "PENDING").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        items: limited,
        counts,
      },
    });
  } catch (error) {
    console.error("[Inbox API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
