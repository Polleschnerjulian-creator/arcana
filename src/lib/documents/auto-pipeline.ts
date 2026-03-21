import { prisma } from "@/lib/db";
import { createWorker } from "tesseract.js";
import { extractDocumentData } from "@/lib/ai/extract";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { findLearnedCategorization } from "@/lib/ai/learning";
import type { AiExtraction } from "@/types";

// ─── Auto-Pipeline: Upload -> OCR -> AI Extract -> Draft Transaction ──

/**
 * Runs the complete document processing pipeline asynchronously
 * after a document upload. Each step is wrapped in try/catch so
 * failures in one step don't prevent status updates or logging.
 *
 * Pipeline:
 * 1. OCR (images via Tesseract, PDFs via pdfjs-dist text extraction)
 * 2. AI extraction (if ANTHROPIC_API_KEY is set)
 * 3. Auto-create DRAFT transaction (if confidence > 0.5)
 */
export async function runDocumentPipeline(
  documentId: string,
  organizationId: string
): Promise<void> {
  console.log(`[Auto-Pipeline] Starting for document ${documentId}`);

  // ─── Step 0: Fetch Document ─────────────────────────────────────
  let document;
  try {
    document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      console.error(`[Auto-Pipeline] Document ${documentId} not found`);
      return;
    }
  } catch (err) {
    console.error("[Auto-Pipeline] Failed to fetch document:", err);
    return;
  }

  // ─── Step 1: OCR / Text Extraction ────────────────────────────
  let ocrText: string | null = null;

  // PDF: extract text with pdfjs-dist
  if (document.mimeType === "application/pdf") {
    try {
      // Mark as processing
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "PROCESSING" },
      });

      // Fetch PDF from storage
      if (!document.storagePath.startsWith("http")) {
        throw new Error("Storage path is not a fetchable URL");
      }

      const response = await fetch(document.storagePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      // Use pdfjs-dist to extract text directly from PDF
      // This works better than OCR for digital PDFs (most invoices)
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

      let extractedText = "";
      const numPages = doc.numPages;

      // Extract text from all pages (up to 10 pages for performance)
      const maxPages = Math.min(numPages, 10);
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: Record<string, unknown>) =>
            "str" in item ? (item.str as string) : ""
          )
          .join(" ");
        extractedText += pageText + "\n";
      }

      extractedText = extractedText.trim();

      // Check if we got substantial text (digital PDF)
      if (extractedText.length > 50) {
        ocrText = extractedText;

        await prisma.document.update({
          where: { id: documentId },
          data: {
            ocrText,
            ocrStatus: "DONE",
          },
        });

        console.log(
          `[Auto-Pipeline] PDF text extraction completed for document ${documentId} (${extractedText.length} chars, ${numPages} pages)`
        );
      } else {
        // Scanned PDF with no embedded text
        await prisma.document.update({
          where: { id: documentId },
          data: {
            ocrStatus: "FAILED",
            ocrText:
              "Gescanntes PDF — bitte als Bild hochladen oder digitales PDF verwenden.",
          },
        });

        console.log(
          `[Auto-Pipeline] Scanned PDF detected for document ${documentId} — no extractable text (${extractedText.length} chars)`
        );
        return; // Stop pipeline — can't extract from scanned PDF without canvas
      }
    } catch (err) {
      console.error("[Auto-Pipeline] PDF text extraction failed:", err);
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { ocrStatus: "FAILED" },
        });
      } catch (updateErr) {
        console.error(
          "[Auto-Pipeline] Failed to update PDF failure status:",
          updateErr
        );
      }
      return;
    }
  }
  // Images: run Tesseract.js
  else if (document.mimeType.startsWith("image/")) {
    try {
      // Mark as processing
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "PROCESSING" },
      });

      // Fetch file from storage
      if (!document.storagePath.startsWith("http")) {
        throw new Error("Storage path is not a fetchable URL");
      }

      const response = await fetch(document.storagePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Run Tesseract.js OCR (German)
      const worker = await createWorker("deu");
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      await worker.terminate();

      ocrText = text;

      // Update document with OCR result
      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrText,
          ocrStatus: "DONE",
        },
      });

      console.log(
        `[Auto-Pipeline] OCR completed for document ${documentId} (${text.length} chars)`
      );
    } catch (err) {
      console.error("[Auto-Pipeline] OCR failed:", err);
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { ocrStatus: "FAILED" },
        });
      } catch (updateErr) {
        console.error(
          "[Auto-Pipeline] Failed to update OCR failure status:",
          updateErr
        );
      }
      return; // Stop pipeline on OCR failure
    }
  } else {
    // Non-image, non-PDF: nothing to OCR
    console.log(
      `[Auto-Pipeline] Unsupported MIME type ${document.mimeType} for OCR`
    );
    return;
  }

  // ─── Step 2: AI Extraction ──────────────────────────────────────
  let extraction: AiExtraction | null = null;

  if (ocrText && process.env.ANTHROPIC_API_KEY) {
    try {
      extraction = await extractDocumentData(ocrText);

      if (extraction) {
        await prisma.document.update({
          where: { id: documentId },
          data: { aiExtraction: JSON.stringify(extraction) },
        });
        console.log(
          `[Auto-Pipeline] AI extraction completed for document ${documentId} (confidence: ${extraction.confidence})`
        );
      } else {
        console.warn(
          `[Auto-Pipeline] AI extraction returned null for document ${documentId}`
        );
      }
    } catch (err) {
      console.warn("[Auto-Pipeline] AI extraction failed:", err);
      // Continue — document stays without extraction
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "[Auto-Pipeline] ANTHROPIC_API_KEY not set — skipping AI extraction"
    );
  }

  // ─── Step 3: Auto-create DRAFT Transaction ─────────────────────
  if (extraction && extraction.confidence > 0.5 && extraction.amount) {
    try {
      // Determine chart of accounts for this org
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { chartOfAccounts: true },
      });

      const chartOfAccounts = org?.chartOfAccounts || "SKR03";

      // Step 1: Check learned categorization (free, instant)
      const learned = extraction.vendor
        ? await findLearnedCategorization(organizationId, extraction.vendor)
        : null;

      if (learned) {
        console.log(
          `[Auto-Pipeline] Using learned categorization for "${extraction.vendor}" (confidence: ${learned.confidence})`
        );
      }

      // Determine accounts based on learned rule or defaults
      let expenseAccount: { id: string; number: string } | null = null;
      let bankAccount: { id: string; number: string } | null = null;

      if (learned) {
        // Use learned categorization accounts
        const learnedDebit = await prisma.account.findFirst({
          where: { organizationId, number: learned.debitAccount },
          select: { id: true, number: true },
        });
        const learnedCredit = await prisma.account.findFirst({
          where: { organizationId, number: learned.creditAccount },
          select: { id: true, number: true },
        });

        if (learnedDebit && learnedCredit) {
          expenseAccount = learnedDebit;
          bankAccount = learnedCredit;
        }
      }

      if (!expenseAccount || !bankAccount) {
        // Fallback: default account lookup
        const expenseAccountNumber = "4900";
        const foundExpense = await prisma.account.findFirst({
          where: { organizationId, number: expenseAccountNumber },
          select: { id: true, number: true },
        });

        if (!foundExpense) {
          // Fallback: find any EXPENSE account
          const anyExpense = await prisma.account.findFirst({
            where: { organizationId, type: "EXPENSE" },
            select: { id: true, number: true },
          });
          expenseAccount = anyExpense;
        } else {
          expenseAccount = foundExpense;
        }

        // Bank account: 1200 for SKR03, 1800 for SKR04
        const bankAccountNumber = chartOfAccounts === "SKR04" ? "1800" : "1200";
        const foundBank = await prisma.account.findFirst({
          where: { organizationId, number: bankAccountNumber },
          select: { id: true, number: true },
        });

        if (!foundBank) {
          // Fallback: find any ASSET account with "Bank" in name
          const anyBank = await prisma.account.findFirst({
            where: {
              organizationId,
              type: "ASSET",
              name: { contains: "Bank" },
            },
            select: { id: true, number: true },
          });
          bankAccount = anyBank;
        } else {
          bankAccount = foundBank;
        }
      }

      if (!expenseAccount || !bankAccount) {
        console.warn(
          `[Auto-Pipeline] Could not find required accounts for auto-transaction (expense: ${!!expenseAccount}, bank: ${!!bankAccount})`
        );
        return;
      }

      const grossAmount = extraction.amount;
      const taxRate = learned?.taxRate ?? extraction.taxRate ?? 0;

      // Build transaction lines
      const lines: {
        accountId: string;
        debit: number;
        credit: number;
        taxRate?: number;
        taxAccountId?: string;
        note?: string;
      }[] = [];

      if (taxRate > 0) {
        // With Vorsteuer
        const netAmount =
          extraction.netAmount ?? grossAmount / (1 + taxRate / 100);
        const taxAmount =
          extraction.taxAmount ?? grossAmount - netAmount;

        // Vorsteuer account: 1576 for SKR03, 1406 for SKR04
        const vorsteuerNumber =
          chartOfAccounts === "SKR04" ? "1406" : "1576";
        const vorsteuerAccount = await prisma.account.findFirst({
          where: { organizationId, number: vorsteuerNumber },
        });

        // Expense line (net amount, Soll)
        lines.push({
          accountId: expenseAccount.id,
          debit: Math.round(netAmount * 100) / 100,
          credit: 0,
          taxRate,
          taxAccountId: vorsteuerAccount?.id || undefined,
          note: extraction.vendor
            ? `${extraction.vendor}${extraction.invoiceNumber ? ` - ${extraction.invoiceNumber}` : ""}`
            : undefined,
        });

        // Vorsteuer line (tax amount, Soll)
        if (vorsteuerAccount) {
          lines.push({
            accountId: vorsteuerAccount.id,
            debit: Math.round(taxAmount * 100) / 100,
            credit: 0,
          });
        }

        // Bank line (gross amount, Haben)
        lines.push({
          accountId: bankAccount.id,
          debit: 0,
          credit: Math.round(grossAmount * 100) / 100,
        });
      } else {
        // Without tax
        // Expense (Soll)
        lines.push({
          accountId: expenseAccount.id,
          debit: Math.round(grossAmount * 100) / 100,
          credit: 0,
          note: extraction.vendor
            ? `${extraction.vendor}${extraction.invoiceNumber ? ` - ${extraction.invoiceNumber}` : ""}`
            : undefined,
        });

        // Bank (Haben)
        lines.push({
          accountId: bankAccount.id,
          debit: 0,
          credit: Math.round(grossAmount * 100) / 100,
        });
      }

      // Parse invoice date
      let transactionDate = new Date();
      if (extraction.invoiceDate) {
        const parsed = new Date(extraction.invoiceDate);
        if (!isNaN(parsed.getTime())) {
          transactionDate = parsed;
        }
      }

      // Create DRAFT transaction
      const transaction = await prisma.transaction.create({
        data: {
          organizationId,
          date: transactionDate,
          description: extraction.vendor
            ? `${extraction.vendor}${extraction.invoiceNumber ? ` RE ${extraction.invoiceNumber}` : ""}`
            : `Beleg ${document.fileName}`,
          reference: extraction.invoiceNumber || undefined,
          documentId,
          status: "DRAFT",
          source: "AI_SUGGESTED",
          aiConfidence: extraction.confidence,
          lines: {
            create: lines,
          },
        },
      });

      console.log(
        `[Auto-Pipeline] Created DRAFT transaction ${transaction.id} for document ${documentId}`
      );

      // Audit entry
      try {
        await createAuditEntry({
          organizationId,
          userId: document.uploadedById,
          action: "CREATE",
          entityType: "TRANSACTION",
          entityId: transaction.id,
          newState: {
            source: "AI_SUGGESTED",
            documentId,
            amount: grossAmount,
            vendor: extraction.vendor,
            confidence: extraction.confidence,
          },
        });
      } catch {
        // Audit failure is non-blocking
      }

      // Cross-match: try to link with existing bank transactions
      try {
        const { crossMatchDocumentWithBank } = await import("@/lib/inbox/cross-match");
        await crossMatchDocumentWithBank(documentId, organizationId);
      } catch (crossMatchErr) {
        console.error("[Cross-Match]", crossMatchErr);
      }
    } catch (err) {
      console.error(
        "[Auto-Pipeline] Failed to create draft transaction:",
        err
      );
    }
  }

  console.log(`[Auto-Pipeline] Completed for document ${documentId}`);
}
