import crypto from "crypto";

// ─── Shopify Webhook Payload Types ─────────────────────────────

export interface ShopifyBillingAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address1: string;
  city: string;
  zip: string;
  country: string;
}

export interface ShopifyLineItem {
  title: string;
  quantity: number;
  price: string; // "50.00"
  variant_title?: string;
}

export interface ShopifyRefundLineItem {
  quantity: number;
  line_item: { title: string; price: string };
}

export interface ShopifyRefund {
  id: number;
  created_at: string;
  refund_line_items: ShopifyRefundLineItem[];
}

export interface ShopifyOrderPayload {
  id: number;
  order_number: number; // e.g., 1001
  name: string; // e.g., "#1001"
  email: string;
  created_at: string;
  total_price: string; // "119.00"
  subtotal_price: string; // "100.00"
  total_tax: string; // "19.00"
  currency: string;
  financial_status: string; // "paid"
  billing_address?: ShopifyBillingAddress;
  line_items: ShopifyLineItem[];
  refunds?: ShopifyRefund[];
}

// ─── HMAC Verification ─────────────────────────────────────────

/**
 * Verify Shopify webhook HMAC signature.
 * Shopify sends X-Shopify-Hmac-Sha256 header with HMAC-SHA256 of the raw body.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Both buffers must be the same length for timingSafeEqual
  const hashBuffer = Buffer.from(hash);
  const hmacBuffer = Buffer.from(hmacHeader);

  if (hashBuffer.length !== hmacBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, hmacBuffer);
}

// ─── Order → Invoice Mapping ───────────────────────────────────

/**
 * Map a Shopify order to ARCANA invoice data.
 *
 * - Customer name: billing_address company || "first_name last_name"
 * - Customer address: "address1, zip city, country"
 * - Line items: map Shopify line_items to { description, quantity, unitPrice }
 * - TaxRate: from the ShopifyConnection.defaultTaxRate
 * - IssueDate: today (YYYY-MM-DD)
 * - DueDate: today (already paid via Shopify)
 */
export function mapShopifyOrderToInvoice(
  order: ShopifyOrderPayload,
  taxRate: number
): {
  customerName: string;
  customerAddress: string;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  taxRate: number;
  issueDate: string;
  dueDate: string;
} {
  // Customer name: prefer company, fallback to full name
  const billing = order.billing_address;
  let customerName = order.email;
  if (billing) {
    customerName = billing.company
      ? billing.company
      : `${billing.first_name} ${billing.last_name}`.trim();
  }

  // Customer address
  let customerAddress = "";
  if (billing) {
    customerAddress = `${billing.address1}, ${billing.zip} ${billing.city}, ${billing.country}`;
  }

  // Map line items
  const lineItems = order.line_items.map((item) => {
    const description = item.variant_title
      ? `${item.title} – ${item.variant_title}`
      : item.title;

    return {
      description,
      quantity: item.quantity,
      unitPrice: parseFloat(item.price),
    };
  });

  // Today's date in YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];

  return {
    customerName,
    customerAddress,
    lineItems,
    taxRate,
    issueDate: today,
    dueDate: today, // Already paid via Shopify
  };
}
