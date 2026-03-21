import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const shopifyConnectionSchema = z.object({
  shopDomain: z
    .string()
    .min(1, "Shop-Domain ist erforderlich.")
    .max(255)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/,
      "Ungültige Shop-Domain. Format: meinshop.myshopify.com"
    ),
  webhookSecret: z
    .string()
    .min(1, "Webhook-Secret ist erforderlich.")
    .max(500),
  defaultTaxRate: z
    .number()
    .refine((v) => [0, 7, 19].includes(v), {
      message: "Steuersatz muss 0, 7 oder 19 sein.",
    })
    .optional()
    .default(19),
});

// ─── GET: Get current ShopifyConnection ─────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const connection = await prisma.shopifyConnection.findUnique({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        shopDomain: true,
        defaultTaxRate: true,
        isActive: true,
        ordersProcessed: true,
        lastOrderAt: true,
        createdAt: true,
        updatedAt: true,
        // Deliberately NOT returning webhookSecret
      },
    });

    return NextResponse.json({
      success: true,
      data: connection, // null if no connection exists
    });
  } catch (error) {
    console.error("Shopify settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create/Update ShopifyConnection ──────────────────────

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
    const data = shopifyConnectionSchema.parse(body);

    // Upsert: one connection per organization
    const connection = await prisma.shopifyConnection.upsert({
      where: { organizationId: session.user.organizationId },
      create: {
        organizationId: session.user.organizationId,
        shopDomain: data.shopDomain,
        webhookSecret: data.webhookSecret,
        defaultTaxRate: data.defaultTaxRate,
        isActive: true,
      },
      update: {
        shopDomain: data.shopDomain,
        webhookSecret: data.webhookSecret,
        defaultTaxRate: data.defaultTaxRate,
        isActive: true, // Re-activate on update
      },
      select: {
        id: true,
        shopDomain: true,
        defaultTaxRate: true,
        isActive: true,
        ordersProcessed: true,
        lastOrderAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "ORGANIZATION",
        entityId: session.user.organizationId,
        newState: {
          shopifyConnection: {
            shopDomain: data.shopDomain,
            defaultTaxRate: data.defaultTaxRate,
            isActive: true,
          },
        },
      });
    } catch {
      // Audit is non-blocking
    }

    return NextResponse.json(
      { success: true, data: connection },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validierungsfehler.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Shopify settings POST error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Deactivate ShopifyConnection ───────────────────────

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const connection = await prisma.shopifyConnection.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "Keine Shopify-Verbindung gefunden." },
        { status: 404 }
      );
    }

    // Deactivate — don't delete (preserve history)
    await prisma.shopifyConnection.update({
      where: { organizationId: session.user.organizationId },
      data: { isActive: false },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "ORGANIZATION",
        entityId: session.user.organizationId,
        previousState: {
          shopifyConnection: {
            shopDomain: connection.shopDomain,
            isActive: true,
          },
        },
        newState: {
          shopifyConnection: {
            shopDomain: connection.shopDomain,
            isActive: false,
          },
        },
      });
    } catch {
      // Audit is non-blocking
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopify settings DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
