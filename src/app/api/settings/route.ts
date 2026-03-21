import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Firmenname muss mindestens 2 Zeichen lang sein.")
    .optional(),
  legalForm: z
    .enum(["EU", "GmbH", "UG", "AG", "OHG", "KG", "GbR", "FreiBeruf"])
    .optional(),
  taxId: z.string().nullable().optional(),
  ustId: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  chartOfAccounts: z.enum(["SKR03", "SKR04"]).optional(),
  accountingMethod: z.enum(["EUR", "BILANZ"]).optional(),
  fiscalYearStart: z.number().min(1).max(12).optional(),
});

// ─── GET: Return org + user data ────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organisation nicht gefunden." },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Check if any BOOKED transactions exist (locks chartOfAccounts)
    const hasBookedTransactions =
      (await prisma.transaction.count({
        where: {
          organizationId: session.user.organizationId,
          status: "BOOKED",
        },
      })) > 0;

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          legalForm: organization.legalForm,
          taxId: organization.taxId,
          ustId: organization.ustId,
          street: organization.street,
          city: organization.city,
          zip: organization.zip,
          chartOfAccounts: organization.chartOfAccounts,
          accountingMethod: organization.accountingMethod,
          fiscalYearStart: organization.fiscalYearStart,
        },
        user,
        hasBookedTransactions,
      },
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update organization settings ────────────────────────

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
    const data = updateOrganizationSchema.parse(body);

    // Prevent changing chartOfAccounts if BOOKED transactions exist
    if (data.chartOfAccounts) {
      const bookedCount = await prisma.transaction.count({
        where: {
          organizationId: session.user.organizationId,
          status: "BOOKED",
        },
      });

      if (bookedCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Der Kontenrahmen kann nach der ersten gebuchten Transaktion nicht mehr geaendert werden.",
          },
          { status: 400 }
        );
      }
    }

    // Get previous state for audit
    const previousOrg = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    // Update organization
    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.legalForm !== undefined && { legalForm: data.legalForm }),
        ...(data.taxId !== undefined && { taxId: data.taxId }),
        ...(data.ustId !== undefined && { ustId: data.ustId }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.zip !== undefined && { zip: data.zip }),
        ...(data.chartOfAccounts !== undefined && {
          chartOfAccounts: data.chartOfAccounts,
        }),
        ...(data.accountingMethod !== undefined && {
          accountingMethod: data.accountingMethod,
        }),
        ...(data.fiscalYearStart !== undefined && {
          fiscalYearStart: data.fiscalYearStart,
        }),
      },
    });

    // Nur sichere Felder loggen (taxId, ustId, Adresse bewusst ausgelassen)
    const safeFields = (org: Record<string, unknown>) => ({
      name: org.name,
      legalForm: org.legalForm,
      chartOfAccounts: org.chartOfAccounts,
      accountingMethod: org.accountingMethod,
      fiscalYearStart: org.fiscalYearStart,
    });

    // Create audit entry
    await createAuditEntry({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ORGANIZATION",
      entityId: session.user.organizationId,
      previousState: previousOrg
        ? safeFields(previousOrg as unknown as Record<string, unknown>)
        : null,
      newState: safeFields(updated as unknown as Record<string, unknown>),
    });

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: updated.id,
          name: updated.name,
          legalForm: updated.legalForm,
          taxId: updated.taxId,
          ustId: updated.ustId,
          street: updated.street,
          city: updated.city,
          zip: updated.zip,
          chartOfAccounts: updated.chartOfAccounts,
          accountingMethod: updated.accountingMethod,
          fiscalYearStart: updated.fiscalYearStart,
        },
      },
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

    console.error("Settings PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
