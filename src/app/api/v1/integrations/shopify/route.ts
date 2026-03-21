import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { learnCategorization } from "@/lib/ai/learning";
import {
  verifyShopifyWebhook,
  mapShopifyOrderToInvoice,
  type ShopifyOrderPayload,
} from "@/lib/integrations/shopify";

// ─── Account mappings per SKR03 ────────────────────────────────

const REVENUE_ACCOUNTS: Record<number, string> = {
  19: "8400", // Erlöse 19% USt
  7: "8300", // Erlöse 7% USt
  0: "8000", // Erlöse (steuerfrei)
};

const TAX_ACCOUNTS: Record<number, string> = {
  19: "1776", // Umsatzsteuer 19%
  7: "1771", // Umsatzsteuer 7%
};

// ─── POST: Receive Shopify Webhooks ─────────────────────────────

export async function POST(request: Request) {
  // 1. Read raw body for HMAC verification
  const rawBody = await request.text();

  // 2. Extract Shopify headers
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") || "";

  if (!hmacHeader || !shopDomain) {
    return NextResponse.json(
      { success: false, error: "Missing Shopify headers." },
      { status: 401 }
    );
  }

  // 3. Find ShopifyConnection by shopDomain
  let connection;
  try {
    connection = await prisma.shopifyConnection.findFirst({
      where: { shopDomain, isActive: true },
    });
  } catch (error) {
    console.error("[Shopify] DB error finding connection:", error);
    return NextResponse.json(
      { success: false, error: "Internal error." },
      { status: 500 }
    );
  }

  if (!connection) {
    // Return 200 — we don't recognize this shop, but don't tell Shopify to retry
    return NextResponse.json({ success: true, message: "Unknown shop domain." });
  }

  // 4. Verify HMAC signature — CRITICAL security check
  if (!verifyShopifyWebhook(rawBody, hmacHeader, connection.webhookSecret)) {
    console.error("[Shopify] HMAC verification failed for shop:", shopDomain);
    return NextResponse.json(
      { success: false, error: "Invalid HMAC signature." },
      { status: 401 }
    );
  }

  // 5. Parse the body as JSON
  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // 6. Handle topics
  try {
    switch (topic) {
      case "orders/paid":
        await handleOrderPaid(connection, payload);
        break;

      case "refunds/create":
        await handleRefundCreate(connection, payload);
        break;

      default:
        // Shopify expects 200 on all webhooks — unhandled topics are fine
        break;
    }

    return NextResponse.json({ success: true, topic });
  } catch (error) {
    console.error(`[Shopify] Error processing ${topic}:`, error);
    // Return 200 to prevent Shopify from retrying endlessly on permanent errors
    // Log the error for investigation
    return NextResponse.json({ success: true, topic, warning: "Processing error logged." });
  }
}

// ─── orders/paid Handler ────────────────────────────────────────

async function handleOrderPaid(
  connection: {
    id: string;
    organizationId: string;
    defaultTaxRate: number;
    shopDomain: string;
  },
  order: ShopifyOrderPayload
) {
  const { organizationId } = connection;
  const shopifyOrderId = String(order.id);

  // 1. Idempotency: check if order already processed
  const existingOrder = await prisma.shopifyOrder.findUnique({
    where: {
      organizationId_shopifyOrderId: {
        organizationId,
        shopifyOrderId,
      },
    },
  });

  if (existingOrder) {
    // Already processed — idempotent
    return;
  }

  // 2. Map Shopify order to ARCANA invoice data
  const invoiceData = mapShopifyOrderToInvoice(order, connection.defaultTaxRate);

  // 3. Calculate line item totals
  const lineItems = invoiceData.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));

  const subtotal =
    Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const taxAmount =
    Math.round(subtotal * (invoiceData.taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // 4. Determine account numbers
  const taxRate = invoiceData.taxRate;
  const revenueAccountNumber = REVENUE_ACCOUNTS[taxRate] || "8000";
  const receivablesAccountNumber = "1400"; // Forderungen aus L+L
  const bankAccountNumber = "1200"; // Bank

  const accountNumbers = [
    receivablesAccountNumber,
    revenueAccountNumber,
    bankAccountNumber,
  ];
  if (taxRate > 0 && TAX_ACCOUNTS[taxRate]) {
    accountNumbers.push(TAX_ACCOUNTS[taxRate]);
  }

  // 5. Do everything in a single DB transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Generate sequential invoice number
    const year = new Date(invoiceData.issueDate).getFullYear();

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

    const invoiceNumber = `RE-${year}-${String(nextNumber).padStart(4, "0")}`;

    // Create invoice (DRAFT initially)
    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        customerName: invoiceData.customerName,
        customerAddress: invoiceData.customerAddress || null,
        issueDate: new Date(invoiceData.issueDate),
        dueDate: new Date(invoiceData.dueDate),
        status: "DRAFT",
        lineItems: JSON.stringify(lineItems),
        subtotal,
        taxAmount,
        total,
      },
    });

    // Look up required accounts
    const accounts = await tx.account.findMany({
      where: {
        organizationId,
        number: { in: accountNumbers },
      },
      select: { id: true, number: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

    // Verify accounts exist
    const missingAccounts = accountNumbers.filter((n) => !accountMap.has(n));
    if (missingAccounts.length > 0) {
      throw new Error(
        `Required accounts not found: ${missingAccounts.join(", ")}. Please set up your chart of accounts.`
      );
    }

    // ── Step A: Mark as SENT — create Forderungen/Erlöse/USt transaction ──

    const sendLines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      taxRate: number | null;
      taxAccountId: string | null;
      note: string | null;
    }> = [];

    // Debit: Receivables (total amount)
    sendLines.push({
      accountId: accountMap.get(receivablesAccountNumber)!,
      debit: total,
      credit: 0,
      taxRate: null,
      taxAccountId: null,
      note: `Rechnung ${invoiceNumber}`,
    });

    // Credit: Revenue (net amount)
    sendLines.push({
      accountId: accountMap.get(revenueAccountNumber)!,
      debit: 0,
      credit: subtotal,
      taxRate: taxRate > 0 ? taxRate : null,
      taxAccountId:
        taxRate > 0 && TAX_ACCOUNTS[taxRate]
          ? accountMap.get(TAX_ACCOUNTS[taxRate]) || null
          : null,
      note: `Erlöse ${invoiceNumber}`,
    });

    // Credit: Tax (if applicable)
    if (taxRate > 0 && taxAmount > 0) {
      sendLines.push({
        accountId: accountMap.get(TAX_ACCOUNTS[taxRate])!,
        debit: 0,
        credit: taxAmount,
        taxRate: null,
        taxAccountId: null,
        note: `USt ${taxRate}% ${invoiceNumber}`,
      });
    }

    const sendTransaction = await tx.transaction.create({
      data: {
        organizationId,
        date: new Date(invoiceData.issueDate),
        description: `Ausgangsrechnung ${invoiceNumber} – ${invoiceData.customerName} (Shopify ${order.name})`,
        reference: invoiceNumber,
        status: "DRAFT",
        source: "API",
        lines: { create: sendLines },
      },
    });

    // Update invoice: DRAFT → SENT, link transaction
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "SENT",
        transactionId: sendTransaction.id,
      },
    });

    // ── Step B: Mark as PAID — create Bank/Forderungen transaction ──

    await tx.transaction.create({
      data: {
        organizationId,
        date: new Date(invoiceData.issueDate),
        description: `Zahlungseingang Rechnung ${invoiceNumber} – ${invoiceData.customerName} (Shopify ${order.name})`,
        reference: invoiceNumber,
        status: "DRAFT",
        source: "API",
        lines: {
          create: [
            {
              accountId: accountMap.get(bankAccountNumber)!,
              debit: total,
              credit: 0,
              note: `Zahlungseingang ${invoiceNumber}`,
            },
            {
              accountId: accountMap.get(receivablesAccountNumber)!,
              debit: 0,
              credit: total,
              note: `Ausgleich Forderung ${invoiceNumber}`,
            },
          ],
        },
      },
    });

    // Update invoice: SENT → PAID
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID" },
    });

    // ── Step C: Create ShopifyOrder record ──

    await tx.shopifyOrder.create({
      data: {
        organizationId,
        shopifyOrderId,
        shopifyOrderNumber: order.name,
        invoiceId: invoice.id,
        transactionId: sendTransaction.id,
        status: "PROCESSED",
        orderTotal: total,
        currency: order.currency || "EUR",
        processedAt: new Date(),
      },
    });

    // ── Step D: Increment ordersProcessed counter ──

    await tx.shopifyConnection.update({
      where: { id: connection.id },
      data: {
        ordersProcessed: { increment: 1 },
        lastOrderAt: new Date(),
      },
    });
  });

  // 6. Audit entry (fire-and-forget, outside transaction)
  try {
    // Find a system user for audit logging
    const systemUser = await prisma.user.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (systemUser) {
      await createAuditEntry({
        organizationId,
        userId: systemUser.id,
        action: "CREATE",
        entityType: "INVOICE",
        entityId: shopifyOrderId,
        newState: {
          source: "shopify",
          shopDomain: connection.shopDomain,
          shopifyOrderNumber: order.name,
          orderTotal: parseFloat(order.total_price),
          currency: order.currency,
        },
      });
    }
  } catch {
    // Audit is non-blocking
  }

  // 7. Learn categorization (fire-and-forget)
  try {
    await learnCategorization({
      organizationId,
      vendorName: connection.shopDomain,
      debitAccountNumber: "1200", // Bank
      creditAccountNumber: REVENUE_ACCOUNTS[connection.defaultTaxRate] || "8400",
      taxRate: connection.defaultTaxRate,
    });
  } catch {
    // Learning is non-blocking
  }
}

// ─── refunds/create Handler ─────────────────────────────────────

async function handleRefundCreate(
  connection: {
    id: string;
    organizationId: string;
    defaultTaxRate: number;
    shopDomain: string;
  },
  payload: ShopifyOrderPayload
) {
  const { organizationId } = connection;
  const shopifyOrderId = String(payload.id);

  // 1. Find the original ShopifyOrder
  const shopifyOrder = await prisma.shopifyOrder.findUnique({
    where: {
      organizationId_shopifyOrderId: {
        organizationId,
        shopifyOrderId,
      },
    },
  });

  if (!shopifyOrder) {
    // We don't have this order — nothing to refund
    return;
  }

  if (!shopifyOrder.invoiceId) {
    // No linked invoice — nothing to cancel
    return;
  }

  // 2. Find the linked invoice with its transaction
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: shopifyOrder.invoiceId,
      organizationId,
    },
    include: {
      transaction: {
        include: { lines: true },
      },
    },
  });

  if (!invoice) {
    return;
  }

  // 3. Cancel the invoice — create storno transaction if SENT/PAID
  if (
    (invoice.status === "SENT" || invoice.status === "PAID") &&
    invoice.transaction
  ) {
    const originalTx = invoice.transaction;

    await prisma.$transaction(async (tx) => {
      // Create reversal (storno) transaction — swap debits and credits
      const stornoTx = await tx.transaction.create({
        data: {
          organizationId,
          date: new Date(),
          description: `Storno: ${originalTx.description} (Shopify Refund)`,
          reference: `STORNO-${invoice.invoiceNumber}`,
          status: "DRAFT",
          source: "API",
          lines: {
            create: originalTx.lines.map((line) => ({
              accountId: line.accountId,
              debit: Number(line.credit), // Swap
              credit: Number(line.debit), // Swap
              taxRate: line.taxRate,
              taxAccountId: line.taxAccountId,
              note: `Storno: ${line.note || ""}`.trim(),
            })),
          },
        },
      });

      // Mark original transaction as cancelled
      await tx.transaction.update({
        where: { id: originalTx.id },
        data: {
          status: "CANCELLED",
          cancelledById: stornoTx.id,
        },
      });

      // Update invoice status
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED" },
      });

      // Update ShopifyOrder status
      await tx.shopifyOrder.update({
        where: {
          organizationId_shopifyOrderId: {
            organizationId,
            shopifyOrderId,
          },
        },
        data: { status: "REFUNDED" },
      });
    });
  } else if (invoice.status === "DRAFT") {
    // DRAFT invoice — just cancel it
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED" },
      });

      await tx.shopifyOrder.update({
        where: {
          organizationId_shopifyOrderId: {
            organizationId,
            shopifyOrderId,
          },
        },
        data: { status: "REFUNDED" },
      });
    });
  }

  // Audit entry (fire-and-forget)
  try {
    const systemUser = await prisma.user.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (systemUser) {
      await createAuditEntry({
        organizationId,
        userId: systemUser.id,
        action: "CANCEL",
        entityType: "INVOICE",
        entityId: shopifyOrder.invoiceId,
        previousState: { status: invoice.status },
        newState: {
          status: "CANCELLED",
          reason: "Shopify Refund",
          shopifyOrderNumber: shopifyOrder.shopifyOrderNumber,
        },
      });
    }
  } catch {
    // Audit is non-blocking
  }
}
