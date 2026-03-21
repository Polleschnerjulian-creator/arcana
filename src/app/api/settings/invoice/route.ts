import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Zod Schema ─────────────────────────────────────────────────

const invoiceSettingsSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Ungueltige Farbe.")
    .optional(),
  bankName: z.string().max(100).optional(),
  bankIban: z.string().max(34).optional(),
  bankBic: z.string().max(11).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  paymentTermsText: z.string().max(500).optional(),
  footerText: z.string().max(500).optional(),
  showUstId: z.boolean().optional(),
  showTaxId: z.boolean().optional(),
});

// ─── GET: Return invoice settings ───────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: "Organisation nicht gefunden." },
        { status: 404 }
      );
    }

    // Parse existing settings JSON
    let settings: Record<string, unknown> = {};
    if (org.settings) {
      try {
        settings = JSON.parse(org.settings);
      } catch {
        // Corrupted JSON — start fresh
      }
    }

    const invoiceSettings = (settings.invoice as Record<string, unknown>) || {};

    return NextResponse.json({
      success: true,
      data: invoiceSettings,
    });
  } catch (error) {
    console.error("Invoice settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update invoice settings ─────────────────────────────

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = invoiceSettingsSchema.parse(body);

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: "Organisation nicht gefunden." },
        { status: 404 }
      );
    }

    // Parse existing settings
    let settings: Record<string, unknown> = {};
    if (org.settings) {
      try {
        settings = JSON.parse(org.settings);
      } catch {
        // Corrupted JSON — start fresh
      }
    }

    // Merge invoice settings
    const existingInvoice = (settings.invoice as Record<string, unknown>) || {};
    settings.invoice = { ...existingInvoice, ...data };

    // Save back
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json({
      success: true,
      data: settings.invoice,
    });
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

    console.error("Invoice settings PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
