import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema for PATCH ───────────────────────────────────────

const invoiceTemplateDataSchema = z.object({
  customerName: z.string().min(1),
  customerAddress: z.string().optional().nullable(),
  taxRate: z.number().refine((v) => [0, 7, 19].includes(v)),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      })
    )
    .min(1),
});

const transactionTemplateDataSchema = z.object({
  description: z.string().min(1),
  reference: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        debit: z.number().min(0),
        credit: z.number().min(0),
      })
    )
    .min(2),
});

const updateRecurringSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────

function getNextRunDate(
  interval: string,
  dayOfMonth: number,
  from?: Date
): Date {
  const now = from || new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), 1);

  const today = now.getDate();
  if (today >= dayOfMonth) {
    if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
    else if (interval === "QUARTERLY") next.setMonth(next.getMonth() + 3);
    else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  }

  const daysInMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();
  next.setDate(Math.min(dayOfMonth, daysInMonth));

  return next;
}

// ─── PATCH: Update Recurring Template ───────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify template belongs to org
    const existing = await prisma.recurringTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vorlage nicht gefunden." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateRecurringSchema.parse(body);

    // Validate templateData if provided, using the existing type
    if (data.templateData) {
      const type = existing.type;
      if (type === "INVOICE") {
        invoiceTemplateDataSchema.parse(data.templateData);
      } else if (type === "TRANSACTION") {
        transactionTemplateDataSchema.parse(data.templateData);
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.templateData !== undefined) {
      updateData.templateData = JSON.stringify(data.templateData);
    }

    // Recalculate nextRunDate if interval or dayOfMonth changed
    const newInterval = data.interval ?? existing.interval;
    const newDayOfMonth = data.dayOfMonth ?? existing.dayOfMonth;
    if (data.interval !== undefined || data.dayOfMonth !== undefined) {
      updateData.interval = newInterval;
      updateData.dayOfMonth = newDayOfMonth;
      updateData.nextRunDate = getNextRunDate(newInterval, newDayOfMonth);
    }

    const updated = await prisma.recurringTemplate.update({
      where: { id },
      data: updateData,
    });

    // Audit entry
    await createAuditEntry({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ORGANIZATION",
      entityId: updated.id,
      previousState: {
        name: existing.name,
        interval: existing.interval,
        dayOfMonth: existing.dayOfMonth,
        isActive: existing.isActive,
      },
      newState: {
        name: updated.name,
        interval: updated.interval,
        dayOfMonth: updated.dayOfMonth,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        templateData: JSON.parse(updated.templateData),
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

    console.error("Error updating recurring template:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Soft-delete (set isActive: false) ──────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify template belongs to org
    const existing = await prisma.recurringTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vorlage nicht gefunden." },
        { status: 404 }
      );
    }

    // Soft-delete: set isActive to false
    const updated = await prisma.recurringTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit entry
    await createAuditEntry({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "DELETE",
      entityType: "ORGANIZATION",
      entityId: updated.id,
      previousState: { isActive: existing.isActive },
      newState: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recurring template:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
