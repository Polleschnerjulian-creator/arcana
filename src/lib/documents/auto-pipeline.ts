import { prisma } from "@/lib/db";
import { createWorker } from "tesseract.js";
import { extractDocumentData } from "@/lib/ai/extract";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import type { AiExtraction } from "@/types";

// ─── Auto-Pipeline: Upload -> OCR -> AI Extract -> Draft Transaction ──

/**
 * Runs the complete document processing pipeline asynchronously
 * after a document upload. Each step is wrapped in try/catch so
 * failures in one step don't prevent status updates or logging.
 *
 * Pipeline:
 * 1. OCR (images only, German language)
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

  // ─── Step 1: OCR ────────────────────────────────────────────────
  let ocrText: string | null = null;

  // PDF: not yet supported
  if (document.mimeType === "application/pdf") {
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "FAILED" },
      });
    } catch (err) {
      console.error("[Auto-Pipeline] Failed to update PDF status:", err);
    }
    console.log(
      `[Auto-Pipeline] PDF OCR not yet supported for document ${documentId}`
    );
    return;
  }

  // Images: run Tesseract.js
  if (document.mimeType.startsWith("image/")) {
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

      // Look up expense account — default to 4900 (Sonstige betriebliche Aufwendungen)
      const expenseAccountNumber = "4900";
      let expenseAccount = await prisma.account.findFirst({
        where: { organizationId, number: expenseAccountNumber },
      });

      if (!expenseAccount) {
        // Fallback: find any EXPENSE account
        expenseAccount = await prisma.account.findFirst({
          where: { organizationId, type: "EXPENSE" },
        });
      }

      // Bank account: 1200 for SKR03, 1800 for SKR04
      const bankAccountNumber = chartOfAccounts === "SKR04" ? "1800" : "1200";
      let bankAccount = await prisma.account.findFirst({
        where: { organizationId, number: bankAccountNumber },
      });

      if (!bankAccount) {
        // Fallback: find any ASSET account with "Bank" in name
        bankAccount = await prisma.account.findFirst({
          where: {
            organizationId,
            type: "ASSET",
            name: { contains: "Bank" },
          },
        });
      }

      if (!expenseAccount || !bankAccount) {
        console.warn(
          `[Auto-Pipeline] Could not find required accounts for auto-transaction (expense: ${!!expenseAccount}, bank: ${!!bankAccount})`
        );
        return;
      }

      const grossAmount = extraction.amount;
      const taxRate = extraction.taxRate ?? 0;

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
    } catch (err) {
      console.error(
        "[Auto-Pipeline] Failed to create draft transaction:",
        err
      );
    }
  }

  console.log(`[Auto-Pipeline] Completed for document ${documentId}`);
}
