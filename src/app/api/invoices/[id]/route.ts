import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schema for Updates ────────────────────────────────────

const updateInvoiceSchema = z.object({
  customerName: z
    .string()
    .min(1, "Kundenname ist erforderlich.")
    .max(200)
    .optional(),
  customerAddress: z.string().max(500).optional().nullable(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat.")
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat.")
    .optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, "Beschreibung ist erforderlich."),
        quantity: z.number().positive("Menge muss positiv sein."),
        unitPrice: z.number().min(0, "Einzelpreis darf nicht negativ sein."),
      })
    )
    .min(1)
    .optional(),
  taxRate: z
    .number()
    .refine((v) => [0, 7, 19].includes(v), {
      message: "Steuersatz muss 0, 7 oder 19 sein.",
    })
    .optional(),
});

// ─── GET: Single Invoice ───────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true,
            zip: true,
            ustId: true,
            taxId: true,
          },
        },
        transaction: {
          select: {
            id: true,
            status: true,
            description: true,
            date: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    const serialized = {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      lineItems: JSON.parse(invoice.lineItems),
    };

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update DRAFT Invoice ───────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const existing = await prisma.invoice.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nur Entwürfe können bearbeitet werden. Versendete oder bezahlte Rechnungen sind unveränderlich.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateInvoiceSchema.parse(body);

    // Build update payload
    const updateData: Record<string, unknown> = {};

    if (data.customerName !== undefined) {
      updateData.customerName = data.customerName;
    }
    if (data.customerAddress !== undefined) {
      updateData.customerAddress = data.customerAddress || null;
    }
    if (data.issueDate !== undefined) {
      updateData.issueDate = new Date(data.issueDate);
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = new Date(data.dueDate);
    }

    // Recalculate totals if lineItems or taxRate changed
    const currentLineItems = data.lineItems
      ? data.lineItems
      : (JSON.parse(existing.lineItems) as Array<{
          description: string;
          quantity: number;
          unitPrice: number;
        }>);

    const currentTaxRate =
      data.taxRate !== undefined
        ? data.taxRate
        : // Derive from existing tax amount / subtotal
          Number(existing.subtotal) > 0
          ? Math.round(
              (Number(existing.taxAmount) / Number(existing.subtotal)) * 100
            )
          : 0;

    if (data.lineItems !== undefined || data.taxRate !== undefined) {
      const lineItems = currentLineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: Math.round(item.quantity * item.unitPrice * 100) / 100,
      }));

      const subtotal =
        Math.round(
          lineItems.reduce((sum, item) => sum + item.total, 0) * 100
        ) / 100;
      const taxAmount =
        Math.round(subtotal * (currentTaxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      updateData.lineItems = JSON.stringify(lineItems);
      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.total = total;
    }

    // Build previous state for audit
    const previousState = {
      customerName: existing.customerName,
      customerAddress: existing.customerAddress,
      issueDate: existing.issueDate.toISOString(),
      dueDate: existing.dueDate.toISOString(),
      subtotal: Number(existing.subtotal),
      taxAmount: Number(existing.taxAmount),
      total: Number(existing.total),
    };

    const updated = await prisma.invoice.update({
      where: { id: id },
      data: updateData,
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "INVOICE",
        entityId: updated.id,
        previousState,
        newState: {
          customerName: updated.customerName,
          customerAddress: updated.customerAddress,
          issueDate: updated.issueDate.toISOString(),
          dueDate: updated.dueDate.toISOString(),
          subtotal: Number(updated.subtotal),
          taxAmount: Number(updated.taxAmount),
          total: Number(updated.total),
        },
      });
    } catch {
      // Audit module may not be ready
    }

    const serialized = {
      ...updated,
      subtotal: Number(updated.subtotal),
      taxAmount: Number(updated.taxAmount),
      total: Number(updated.total),
      lineItems: JSON.parse(updated.lineItems),
    };

    return NextResponse.json({ success: true, data: serialized });
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

    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete DRAFT Invoice ──────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const existing = await prisma.invoice.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nur Entwürfe können gelöscht werden. Versendete Rechnungen müssen storniert werden.",
        },
        { status: 403 }
      );
    }

    await prisma.invoice.delete({
      where: { id: id },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DELETE",
        entityType: "INVOICE",
        entityId: id,
        previousState: {
          invoiceNumber: existing.invoiceNumber,
          customerName: existing.customerName,
          status: existing.status,
          total: Number(existing.total),
        },
      });
    } catch {
      // Audit module may not be ready
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
