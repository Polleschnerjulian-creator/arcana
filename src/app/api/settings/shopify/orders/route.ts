import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: List processed ShopifyOrders ──────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const [orders, total] = await Promise.all([
      prisma.shopifyOrder.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { processedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.shopifyOrder.count({
        where: { organizationId: session.user.organizationId },
      }),
    ]);

    // Fetch linked invoices for the orders that have them
    const invoiceIds = orders
      .map((o) => o.invoiceId)
      .filter((id): id is string => id !== null);

    const invoices =
      invoiceIds.length > 0
        ? await prisma.invoice.findMany({
            where: {
              id: { in: invoiceIds },
              organizationId: session.user.organizationId,
            },
            select: {
              id: true,
              invoiceNumber: true,
              customerName: true,
              status: true,
              total: true,
            },
          })
        : [];

    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    // Serialize: merge invoice info into each order
    const serialized = orders.map((order) => {
      const linkedInvoice = order.invoiceId
        ? invoiceMap.get(order.invoiceId)
        : null;

      return {
        id: order.id,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderNumber: order.shopifyOrderNumber,
        status: order.status,
        orderTotal: Number(order.orderTotal),
        currency: order.currency,
        processedAt: order.processedAt,
        invoice: linkedInvoice
          ? {
              id: linkedInvoice.id,
              invoiceNumber: linkedInvoice.invoiceNumber,
              customerName: linkedInvoice.customerName,
              status: linkedInvoice.status,
              total: Number(linkedInvoice.total),
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: serialized,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Shopify orders GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
