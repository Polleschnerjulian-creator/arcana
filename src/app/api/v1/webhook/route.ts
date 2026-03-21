import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { saveDocument } from "@/lib/documents/storage";

// ─── Zod Schemas ────────────────────────────────────────────────

const lineItemSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich."),
  quantity: z.number().positive("Menge muss positiv sein."),
  unitPrice: z.number().min(0, "Einzelpreis darf nicht negativ sein."),
});

const invoiceDataSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerAddress: z.string().max(500).optional().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxRate: z.number().refine((v) => [0, 7, 19].includes(v), {
    message: "Steuersatz muss 0, 7 oder 19 sein.",
  }),
  lineItems: z.array(lineItemSchema).min(1),
});

const documentDataSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url("Ungültige URL."),
  type: z.enum([
    "INCOMING_INVOICE",
    "OUTGOING_INVOICE",
    "RECEIPT",
    "BANK_STATEMENT",
    "OTHER",
  ]),
});

const transactionDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  amount: z.number().positive("Betrag muss positiv sein."),
  taxRate: z.number().refine((v) => [0, 7, 19].includes(v), {
    message: "Steuersatz muss 0, 7 oder 19 sein.",
  }),
  counterpart: z.string().max(200).optional().nullable(),
  type: z.enum(["income", "expense"]),
});

const webhookPayloadSchema = z.object({
  event: z.enum([
    "invoice.created",
    "document.uploaded",
    "transaction.created",
  ]),
  source: z.enum(["zapier", "stripe", "billbee", "custom"]),
  data: z.record(z.string(), z.unknown()),
});

// ─── POST: Receive Webhook Events ──────────────────────────────

export async function POST(request: Request) {
  // 1. Authenticate via API key (not NextAuth session)
  let auth: { organizationId: string; keyId: string } | null = null;

  try {
    auth = await authenticateApiKey(request);
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentifizierungsfehler." },
      { status: 500 }
    );
  }

  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Ungültiger oder fehlender API-Schlüssel." },
      { status: 401 }
    );
  }

  // 2. Rate limiting: 60 requests per minute per API key
  const rateLimitResult = rateLimit(`webhook:${auth.keyId}`, 60, 60_000);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate-Limit überschritten. Maximal 60 Anfragen pro Minute.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 3. Parse and validate webhook payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Ungültiger JSON-Body." },
      { status: 400 }
    );
  }

  let payload: z.infer<typeof webhookPayloadSchema>;
  try {
    payload = webhookPayloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validierungsfehler im Webhook-Payload.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Ungültiger Webhook-Payload." },
      { status: 400 }
    );
  }

  // 4. Log the webhook (status: RECEIVED)
  let webhookLog;
  try {
    webhookLog = await prisma.webhookLog.create({
      data: {
        organizationId: auth.organizationId,
        source: payload.source,
        event: payload.event,
        payload: JSON.stringify(body),
        status: "RECEIVED",
      },
    });
  } catch (error) {
    console.error("Failed to create webhook log:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }

  // 5. Process based on event type
  try {
    let resultId: string;

    switch (payload.event) {
      case "invoice.created":
        resultId = await processInvoiceCreated(
          auth.organizationId,
          payload.data
        );
        break;
      case "document.uploaded":
        resultId = await processDocumentUploaded(
          auth.organizationId,
          payload.data
        );
        break;
      case "transaction.created":
        resultId = await processTransactionCreated(
          auth.organizationId,
          payload.data
        );
        break;
      default:
        throw new Error(`Unbekannter Event-Typ: ${payload.event}`);
    }

    // Update webhook log: PROCESSED
    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        event: payload.event,
        id: resultId,
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  } catch (error) {
    // Update webhook log: FAILED
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    try {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          status: "FAILED",
          errorMessage,
          processedAt: new Date(),
        },
      });
    } catch (logError) {
      console.error("Failed to update webhook log:", logError);
    }

    console.error(`Webhook processing failed [${payload.event}]:`, error);

    return NextResponse.json(
      {
        success: false,
        error: `Verarbeitung fehlgeschlagen: ${errorMessage}`,
        webhookLogId: webhookLog.id,
      },
      { status: 422 }
    );
  }
}

// ─── Event Processors ───────────────────────────────────────────

/**
 * invoice.created — Erstellt eine Ausgangsrechnung aus externen Daten.
 */
async function processInvoiceCreated(
  organizationId: string,
  rawData: Record<string, unknown>
): Promise<string> {
  const data = invoiceDataSchema.parse(rawData);

  // Calculate line item totals
  const lineItems = data.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));

  const subtotal =
    Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) /
    100;
  const taxAmount = Math.round(subtotal * (data.taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Generate sequential invoice number
  const year = new Date(data.issueDate).getFullYear();

  const invoice = await prisma.$transaction(async (tx) => {
    const lastInvoice = await tx.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: { startsWith: `RE-${year}-` },
      },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const lastNumStr = lastInvoice.invoiceNumber.split("-").pop();
      if (lastNumStr) {
        nextNumber = parseInt(lastNumStr, 10) + 1;
      }
    }

    let invoiceNumber = `RE-${year}-${String(nextNumber).padStart(4, "0")}`;

    // Retry on unique constraint violation (race condition)
    let retries = 3;
    while (retries > 0) {
      try {
        return await tx.invoice.create({
          data: {
            organizationId,
            invoiceNumber,
            customerName: data.customerName,
            customerAddress: data.customerAddress || null,
            issueDate: new Date(data.issueDate),
            dueDate: new Date(data.dueDate),
            status: "DRAFT",
            lineItems: JSON.stringify(lineItems),
            subtotal,
            taxAmount,
            total,
          },
        });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2002" && retries > 1) {
          nextNumber++;
          invoiceNumber = `RE-${year}-${String(nextNumber).padStart(4, "0")}`;
          retries--;
          continue;
        }
        throw err;
      }
    }

    throw new Error("Invoice number generation failed after retries");
  });

  return invoice.id;
}

/**
 * document.uploaded — Erstellt einen Dokumenteneintrag aus einer externen URL.
 * Lädt die Datei herunter und speichert sie in Vercel Blob.
 */
async function processDocumentUploaded(
  organizationId: string,
  rawData: Record<string, unknown>
): Promise<string> {
  const data = documentDataSchema.parse(rawData);

  // Fetch the file from the provided URL
  const fileResponse = await fetch(data.fileUrl, {
    signal: AbortSignal.timeout(30_000), // 30s timeout for file download
  });

  if (!fileResponse.ok) {
    throw new Error(
      `Datei konnte nicht heruntergeladen werden: HTTP ${fileResponse.status}`
    );
  }

  const contentLength = fileResponse.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    throw new Error("Datei zu groß. Maximale Dateigröße: 10 MB.");
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Datei zu groß. Maximale Dateigröße: 10 MB.");
  }

  // Determine MIME type from Content-Type header or file extension
  const contentType =
    fileResponse.headers.get("content-type") ||
    getMimeTypeFromFilename(data.fileName);

  // Save to Vercel Blob
  const { storagePath, sha256Hash } = await saveDocument(
    buffer,
    data.fileName,
    organizationId
  );

  // Determine OCR status based on file type — images get OCR
  const isImage = contentType.startsWith("image/");
  const ocrStatus = isImage ? "PENDING" : "PENDING";

  // Create document record
  // Use a system user ID for webhook-created documents
  const systemUser = await prisma.user.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!systemUser) {
    throw new Error("Kein Benutzer in der Organisation gefunden.");
  }

  const document = await prisma.document.create({
    data: {
      organizationId,
      fileName: data.fileName,
      mimeType: contentType,
      fileSize: buffer.length,
      storagePath,
      sha256Hash,
      uploadedById: systemUser.id,
      type: data.type,
      ocrStatus,
    },
  });

  return document.id;
}

/**
 * transaction.created — Erstellt eine Buchung mit doppelter Buchführung.
 * Legt automatisch Soll/Haben-Zeilen an (Bank/Erlöse oder Bank/Aufwand + USt).
 */
async function processTransactionCreated(
  organizationId: string,
  rawData: Record<string, unknown>
): Promise<string> {
  const data = transactionDataSchema.parse(rawData);

  // Calculate net and tax amounts
  const grossAmount = Math.round(data.amount * 100) / 100;
  const netAmount =
    data.taxRate > 0
      ? Math.round((grossAmount / (1 + data.taxRate / 100)) * 100) / 100
      : grossAmount;
  const taxAmount = Math.round((grossAmount - netAmount) * 100) / 100;

  // Determine the organization's chart of accounts
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { chartOfAccounts: true },
  });

  if (!org) {
    throw new Error("Organisation nicht gefunden.");
  }

  const isSKR03 = org.chartOfAccounts === "SKR03";

  // Look up required accounts
  // Bank account: SKR03=1200, SKR04=1800
  const bankAccountNumber = isSKR03 ? "1200" : "1800";
  // Revenue account: SKR03=8400 (Erlöse 19%), SKR04=4400
  const revenueAccountNumber = isSKR03 ? "8400" : "4400";
  // Expense account: SKR03=4900 (sonst. betriebl. Aufwand), SKR04=6300
  const expenseAccountNumber = isSKR03 ? "4900" : "6300";
  // USt account: SKR03=1776, SKR04=3806
  const ustAccountNumber = isSKR03 ? "1776" : "3806";
  // VSt account: SKR03=1576, SKR04=1406
  const vstAccountNumber = isSKR03 ? "1576" : "1406";

  const targetAccountNumber =
    data.type === "income" ? revenueAccountNumber : expenseAccountNumber;
  const taxAccountNumber =
    data.type === "income" ? ustAccountNumber : vstAccountNumber;

  // Find the accounts in the database
  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      number: {
        in: [bankAccountNumber, targetAccountNumber, taxAccountNumber],
      },
    },
    select: { id: true, number: true },
  });

  const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

  const bankAccountId = accountMap.get(bankAccountNumber);
  const targetAccountId = accountMap.get(targetAccountNumber);
  const taxAccountId = accountMap.get(taxAccountNumber);

  if (!bankAccountId) {
    throw new Error(
      `Bankkonto (${bankAccountNumber}) nicht gefunden. Bitte Kontenrahmen einrichten.`
    );
  }
  if (!targetAccountId) {
    throw new Error(
      `Konto ${targetAccountNumber} nicht gefunden. Bitte Kontenrahmen einrichten.`
    );
  }

  // Build double-entry lines
  type TxLine = {
    accountId: string;
    debit: number;
    credit: number;
    taxRate: number | null;
    taxAccountId: string | null;
    note: string | null;
  };

  const lines: TxLine[] = [];

  if (data.type === "income") {
    // Income: Bank (Soll) an Erlöse (Haben) + USt (Haben)
    lines.push({
      accountId: bankAccountId,
      debit: grossAmount,
      credit: 0,
      taxRate: null,
      taxAccountId: null,
      note: null,
    });
    lines.push({
      accountId: targetAccountId,
      debit: 0,
      credit: netAmount,
      taxRate: data.taxRate > 0 ? data.taxRate : null,
      taxAccountId: data.taxRate > 0 ? (taxAccountId ?? null) : null,
      note: null,
    });
    if (data.taxRate > 0 && taxAccountId) {
      lines.push({
        accountId: taxAccountId,
        debit: 0,
        credit: taxAmount,
        taxRate: null,
        taxAccountId: null,
        note: `USt ${data.taxRate}%`,
      });
    }
  } else {
    // Expense: Aufwand (Soll) + VSt (Soll) an Bank (Haben)
    lines.push({
      accountId: targetAccountId,
      debit: netAmount,
      credit: 0,
      taxRate: data.taxRate > 0 ? data.taxRate : null,
      taxAccountId: data.taxRate > 0 ? (taxAccountId ?? null) : null,
      note: null,
    });
    if (data.taxRate > 0 && taxAccountId) {
      lines.push({
        accountId: taxAccountId,
        debit: taxAmount,
        credit: 0,
        taxRate: null,
        taxAccountId: null,
        note: `VSt ${data.taxRate}%`,
      });
    }
    lines.push({
      accountId: bankAccountId,
      debit: 0,
      credit: grossAmount,
      taxRate: null,
      taxAccountId: null,
      note: null,
    });
  }

  // Create transaction with lines
  const transaction = await prisma.transaction.create({
    data: {
      organizationId,
      date: new Date(data.date),
      description: data.description,
      reference: data.counterpart || null,
      status: "DRAFT",
      source: "API",
      lines: {
        create: lines,
      },
    },
  });

  return transaction.id;
}

// ─── Helpers ────────────────────────────────────────────────────

function getMimeTypeFromFilename(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
