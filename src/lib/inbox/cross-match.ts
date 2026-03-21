import { prisma } from "@/lib/db";
import { nameSimilarity } from "@/lib/bank/matching";
import type { AiExtraction } from "@/types";

// ─── Cross-Match: Link documents with bank transactions ─────────

/**
 * After a document is processed (OCR + AI extraction), try to find
 * a matching UNMATCHED bank transaction in the same organization.
 *
 * Matching criteria:
 * - Same amount (+-0.01 EUR tolerance)
 * - Similar date (+-7 days)
 * - Similar vendor/counterpart name (>30% similarity)
 *
 * If a match is found with >80% combined confidence:
 * - Link the bank transaction to the document's draft transaction
 * - Set bank transaction matchStatus to AI_SUGGESTED
 */
export async function crossMatchDocumentWithBank(
  documentId: string,
  organizationId: string
): Promise<{ matched: boolean; bankTransactionId?: string }> {
  console.log(`[Cross-Match] Starting for document ${documentId}`);

  // Step 1: Get the document's AI extraction
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    select: {
      aiExtraction: true,
      transactions: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!document?.aiExtraction) {
    console.log("[Cross-Match] No AI extraction found for document");
    return { matched: false };
  }

  let extraction: AiExtraction;
  try {
    extraction =
      typeof document.aiExtraction === "string"
        ? JSON.parse(document.aiExtraction)
        : document.aiExtraction;
  } catch {
    console.error("[Cross-Match] Failed to parse AI extraction");
    return { matched: false };
  }

  if (!extraction.amount) {
    console.log("[Cross-Match] No amount in extraction");
    return { matched: false };
  }

  const draftTransaction = document.transactions[0];
  if (!draftTransaction) {
    console.log("[Cross-Match] No draft transaction linked to document");
    return { matched: false };
  }

  // Step 2: Get all UNMATCHED bank transactions for this org
  const unmatchedBankTxs = await prisma.bankTransaction.findMany({
    where: {
      matchStatus: "UNMATCHED",
      bankAccount: { organizationId },
    },
    select: {
      id: true,
      amount: true,
      date: true,
      counterpartName: true,
      description: true,
    },
  });

  if (unmatchedBankTxs.length === 0) {
    console.log("[Cross-Match] No unmatched bank transactions found");
    return { matched: false };
  }

  // Step 3: Score each bank transaction
  const AMOUNT_TOLERANCE = 0.01;
  const DATE_WINDOW_DAYS = 7;

  let bestMatch: { id: string; score: number } | null = null;

  for (const bankTx of unmatchedBankTxs) {
    let score = 0;
    const bankAmount = Math.abs(Number(bankTx.amount));
    const docAmount = Math.abs(extraction.amount);

    // Amount match (weight: 0.5)
    const amountDiff = Math.abs(bankAmount - docAmount);
    if (amountDiff <= AMOUNT_TOLERANCE) {
      score += 0.5; // Exact match
    } else if (bankAmount > 0 && amountDiff / bankAmount <= 0.01) {
      score += 0.4; // Within 1%
    }

    // Date match (weight: 0.3)
    if (extraction.invoiceDate) {
      const docDate = new Date(extraction.invoiceDate);
      const bankDate = new Date(bankTx.date);
      const daysDiff =
        Math.abs(docDate.getTime() - bankDate.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysDiff <= 1) {
        score += 0.3;
      } else if (daysDiff <= DATE_WINDOW_DAYS) {
        score += 0.3 * (1 - daysDiff / DATE_WINDOW_DAYS);
      }
    }

    // Name match (weight: 0.2)
    if (extraction.vendor) {
      const nameToCompare =
        bankTx.counterpartName || bankTx.description || "";
      const similarity = nameSimilarity(extraction.vendor, nameToCompare);
      score += similarity * 0.2;
    }

    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { id: bankTx.id, score };
    }
  }

  // Step 4: If match found with >80% confidence, link them
  if (bestMatch && bestMatch.score > 0.8) {
    try {
      await prisma.bankTransaction.update({
        where: { id: bestMatch.id },
        data: {
          matchedTransactionId: draftTransaction.id,
          matchConfidence: bestMatch.score,
          matchStatus: "AI_SUGGESTED",
        },
      });

      console.log(
        `[Cross-Match] Matched bank transaction ${bestMatch.id} to document ${documentId} (confidence: ${bestMatch.score})`
      );

      return { matched: true, bankTransactionId: bestMatch.id };
    } catch (err) {
      console.error("[Cross-Match] Failed to update bank transaction:", err);
      return { matched: false };
    }
  }

  console.log(
    `[Cross-Match] No confident match found (best score: ${bestMatch?.score ?? 0})`
  );
  return { matched: false };
}
