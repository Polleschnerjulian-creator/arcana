import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const lineItemSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich."),
  quantity: z.number().positive("Menge muss positiv sein."),
  unitPrice: z.number().min(0, "Einzelpreis darf nicht negativ sein."),
});

const createInvoiceSchema = z.object({
  customerName: z
    .string()
    .min(1, "Kundenname ist erforderlich.")
    .max(200, "Kundenname darf maximal 200 Zeichen lang sein."),
  customerAddress: z.string().max(500).optional().nullable(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD"),
  lineItems: z
    .array(lineItemSchema)
    .min(1, "Mindestens eine Position ist erforderlich."),
  taxRate: z
    .number()
    .refine((v) => [0, 7, 19].includes(v), {
      message: "Steuersatz muss 0, 7 oder 19 sein.",
    }),
});

// ─── GET: List Invoices ─────────────────────────────────────────

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
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { invoiceNumber: { contains: search } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            description: true,
            date: true,
          },
        },
      },
      orderBy: { issueDate: "desc" },
    });

    // Serialize Decimal fields
    const serialized = invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      total: Number(inv.total),
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create Invoice ───────────────────────────────────────

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
    const data = createInvoiceSchema.parse(body);

    // Calculate line item totals
    const lineItems = data.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

    const subtotal = Math.round(
      lineItems.reduce((sum, item) => sum + item.total, 0) * 100
    ) / 100;
    const taxAmount = Math.round(subtotal * (data.taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // Generate sequential invoice number
    const year = new Date(data.issueDate).getFullYear();

    const invoice = await prisma.$transaction(async (tx) => {
      // Find the last invoice for this org in this year
      const lastInvoice = await tx.invoice.findFirst({
        where: {
          organizationId: session.user.organizationId,
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
              organizationId: session.user.organizationId,
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
            // Unique constraint violation — increment and retry
            nextNumber++;
            invoiceNumber = `RE-${year}-${String(nextNumber).padStart(4, "0")}`;
            retries--;
            continue;
          }
          throw err;
        }
      }

      // Fallback (should not reach here)
      throw new Error("Invoice number generation failed after retries");
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "INVOICE",
        entityId: invoice.id,
        newState: {
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          status: invoice.status,
          total: Number(invoice.total),
        },
      });
    } catch {
      // Audit module may not be ready
    }

    // Serialize Decimal fields
    const serialized = {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
    };

    return NextResponse.json(
      { success: true, data: serialized },
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

    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
