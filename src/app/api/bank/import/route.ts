import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { parseCSV, getTemplateById } from "@/lib/bank/csv-parser";
import { parseMT940 } from "@/lib/bank/mt940-parser";
import { findPotentialMatches } from "@/lib/bank/matching";
import type { ParsedBankTransaction } from "@/lib/bank/csv-parser";
import type { OpenItem } from "@/lib/bank/matching";

// ─── POST: Import Bank Transactions ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Multipart-Formular parsen
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bankAccountId = formData.get("bankAccountId") as string | null;
    const format = formData.get("format") as string | null;

    // Validierung
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    // Dateigröße prüfen (max. 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Datei zu groß. Maximale Größe: 5 MB." },
        { status: 413 }
      );
    }

    if (!bankAccountId) {
      return NextResponse.json(
        { success: false, error: "Bankkonto-ID ist erforderlich." },
        { status: 400 }
      );
    }

    if (!format) {
      return NextResponse.json(
        { success: false, error: "Format ist erforderlich (sparkasse, dkb, ing, commerzbank, generic, mt940)." },
        { status: 400 }
      );
    }

    const validFormats = ["sparkasse", "dkb", "ing", "commerzbank", "generic", "mt940"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Ungültiges Format: "${format}". Erlaubt: ${validFormats.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Bankkonto prüfen — muss zur Organisation gehören
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!bankAccount) {
      return NextResponse.json(
        {
          success: false,
          error: "Bankkonto nicht gefunden oder gehört nicht zu Ihrer Organisation.",
        },
        { status: 404 }
      );
    }

    // Datei-Inhalt lesen
    const fileContent = await file.text();

    if (!fileContent.trim()) {
      return NextResponse.json(
        { success: false, error: "Die hochgeladene Datei ist leer." },
        { status: 400 }
      );
    }

    // Parsen je nach Format
    let transactions: ParsedBankTransaction[];

    if (format === "mt940") {
      transactions = parseMT940(fileContent);
    } else {
      const template = getTemplateById(format);
      if (!template) {
        return NextResponse.json(
          { success: false, error: `Template "${format}" nicht gefunden.` },
          { status: 400 }
        );
      }
      transactions = parseCSV(fileContent, template);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Keine Transaktionen in der Datei gefunden. Bitte prüfen Sie das Format.",
        },
        { status: 400 }
      );
    }

    // Eindeutige Batch-ID generieren
    const importBatch = `IMPORT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Transaktionen in der Datenbank erstellen
    const created = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const parsed of transactions) {
        const record = await tx.bankTransaction.create({
          data: {
            bankAccountId,
            date: parsed.date,
            amount: parsed.amount,
            description: parsed.description,
            counterpartName: parsed.counterpartName || null,
            counterpartIban: parsed.counterpartIban || null,
            importBatch,
            matchStatus: "UNMATCHED",
          },
        });
        records.push(record);
      }

      // lastImportAt aktualisieren
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { lastImportAt: new Date() },
      });

      return records;
    });

    // Audit-Eintrag
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "BANK_TRANSACTION",
        entityId: importBatch,
        newState: {
          bankAccountId,
          format,
          fileName: file.name,
          transactionCount: created.length,
          batch: importBatch,
        },
      });
    } catch {
      // Audit-Modul darf den Import nicht blockieren
    }

    // ─── Auto-Matching ─────────────────────────────────────────────
    let autoConfirmed = 0;
    let autoSuggested = 0;

    try {
      // Fetch ALL unmatched bank transactions for this org (not just this batch)
      const unmatchedBankTxs = await prisma.bankTransaction.findMany({
        where: {
          matchStatus: "UNMATCHED",
          bankAccount: { organizationId: session.user.organizationId },
        },
      });

      // Fetch all unlinked BOOKED transactions as potential match targets
      const bookedTransactions = await prisma.transaction.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "BOOKED",
          bankTransactions: { none: {} },
        },
        include: {
          lines: { include: { account: true } },
        },
      });

      // Build open items from booked transactions
      const openItems: OpenItem[] = bookedTransactions.map((tx) => {
        // Calculate total amount from transaction lines
        const totalDebit = tx.lines.reduce(
          (sum, l) => sum + Number(l.debit),
          0
        );
        const totalCredit = tx.lines.reduce(
          (sum, l) => sum + Number(l.credit),
          0
        );

        return {
          id: tx.id,
          type: "transaction" as const,
          amount: totalDebit > 0 ? totalDebit : -totalCredit,
          date: tx.date,
          description: tx.description,
          counterpartName: tx.reference || undefined,
        };
      });

      if (openItems.length > 0) {
        for (const bankTx of unmatchedBankTxs) {
          const matches = findPotentialMatches(
            {
              amount: Number(bankTx.amount),
              date: bankTx.date,
              counterpartName: bankTx.counterpartName || undefined,
            },
            openItems
          );

          if (matches.length > 0 && matches[0].confidence > 0.85) {
            // >95% confidence: auto-confirm (no user action needed)
            // 85-95% confidence: AI suggestion (user confirms)
            const isHighConfidence = matches[0].confidence > 0.95;

            await prisma.bankTransaction.update({
              where: { id: bankTx.id },
              data: {
                matchedTransactionId: matches[0].openItemId,
                matchConfidence: matches[0].confidence,
                matchStatus: isHighConfidence ? "CONFIRMED" : "AI_SUGGESTED",
              },
            });

            if (isHighConfidence) {
              autoConfirmed++;

              // Auto-mark linked invoice as PAID for auto-confirmed matches
              try {
                const linkedInvoice = await prisma.invoice.findFirst({
                  where: {
                    transactionId: matches[0].openItemId,
                    status: { in: ["SENT", "OVERDUE"] },
                  },
                });

                if (linkedInvoice) {
                  await prisma.invoice.update({
                    where: { id: linkedInvoice.id },
                    data: { status: "PAID" },
                  });

                  await createAuditEntry({
                    organizationId: session.user.organizationId,
                    userId: session.user.id,
                    action: "UPDATE",
                    entityType: "INVOICE",
                    entityId: linkedInvoice.id,
                    previousState: { status: linkedInvoice.status },
                    newState: { status: "PAID", paidVia: "BANK_MATCH_AUTO" },
                  }).catch(() => {});
                }
              } catch {
                // Auto-pay darf den Import nicht blockieren
              }

              // Auto-book the matched transaction if still DRAFT
              try {
                const matchedTx = await prisma.transaction.findUnique({
                  where: { id: matches[0].openItemId },
                });

                if (matchedTx && matchedTx.status === "DRAFT") {
                  await prisma.transaction.update({
                    where: { id: matchedTx.id },
                    data: {
                      status: "BOOKED",
                      bookedAt: new Date(),
                      bookedById: session.user.id,
                    },
                  });

                  await createAuditEntry({
                    organizationId: session.user.organizationId,
                    userId: session.user.id,
                    action: "BOOK",
                    entityType: "TRANSACTION",
                    entityId: matchedTx.id,
                    previousState: { status: "DRAFT" },
                    newState: { status: "BOOKED", bookedVia: "BANK_MATCH_AUTO" },
                  }).catch(() => {});
                }
              } catch {
                // Auto-book darf den Import nicht blockieren
              }
            } else {
              autoSuggested++;
            }

            // Remove matched item from open items to prevent double-matching
            const matchedIdx = openItems.findIndex(
              (item) => item.id === matches[0].openItemId
            );
            if (matchedIdx !== -1) {
              openItems.splice(matchedIdx, 1);
            }
          }
        }
      }
    } catch (matchErr) {
      console.error("[Bank Import] Auto-matching failed:", matchErr);
      // Auto-matching failure does not block the import response
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          imported: created.length,
          autoConfirmed,
          autoSuggested,
          autoMatched: autoConfirmed + autoSuggested,
          batch: importBatch,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing bank transactions:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler beim Import." },
      { status: 500 }
    );
  }
}
