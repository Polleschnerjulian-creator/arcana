import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const invoiceTemplateDataSchema = z.object({
  customerName: z.string().min(1, "Kundenname ist erforderlich."),
  customerAddress: z.string().optional().nullable(),
  taxRate: z.number().refine((v) => [0, 7, 19].includes(v), {
    message: "Steuersatz muss 0, 7 oder 19 sein.",
  }),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, "Beschreibung ist erforderlich."),
        quantity: z.number().positive("Menge muss positiv sein."),
        unitPrice: z.number().min(0, "Einzelpreis darf nicht negativ sein."),
      })
    )
    .min(1, "Mindestens eine Position ist erforderlich."),
});

const transactionTemplateDataSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich."),
  reference: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, "Konto-ID ist erforderlich."),
        debit: z.number().min(0, "Soll darf nicht negativ sein."),
        credit: z.number().min(0, "Haben darf nicht negativ sein."),
      })
    )
    .min(2, "Mindestens 2 Buchungszeilen erforderlich."),
});

const createRecurringSchema = z
  .object({
    type: z.enum(["INVOICE", "TRANSACTION"]),
    name: z
      .string()
      .min(1, "Name ist erforderlich.")
      .max(200, "Name darf maximal 200 Zeichen lang sein."),
    interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
    dayOfMonth: z
      .number()
      .int()
      .min(1, "Tag muss mindestens 1 sein.")
      .max(28, "Tag darf maximal 28 sein."),
    templateData: z.record(z.string(), z.unknown()),
  })
  .superRefine((data, ctx) => {
    if (data.type === "INVOICE") {
      const result = invoiceTemplateDataSchema.safeParse(data.templateData);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["templateData", ...issue.path],
          });
        }
      }
    } else if (data.type === "TRANSACTION") {
      const result = transactionTemplateDataSchema.safeParse(data.templateData);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["templateData", ...issue.path],
          });
        }
      }
    }
  });

// ─── Helpers ────────────────────────────────────────────────────

function getNextRunDate(
  interval: string,
  dayOfMonth: number,
  from?: Date
): Date {
  const now = from || new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), 1);

  // Start from current month — if dayOfMonth hasn't passed yet, use this month
  const today = now.getDate();
  if (today >= dayOfMonth) {
    // Move to next interval
    if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
    else if (interval === "QUARTERLY") next.setMonth(next.getMonth() + 3);
    else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  }

  // Clamp dayOfMonth to actual days in the target month
  const daysInMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();
  next.setDate(Math.min(dayOfMonth, daysInMonth));

  return next;
}

// ─── GET: List Recurring Templates ──────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const templates = await prisma.recurringTemplate.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = templates.map((t) => ({
      ...t,
      templateData: JSON.parse(t.templateData),
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching recurring templates:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create Recurring Template ────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = createRecurringSchema.parse(body);

    const nextRunDate = getNextRunDate(data.interval, data.dayOfMonth);

    const template = await prisma.recurringTemplate.create({
      data: {
        organizationId: session.user.organizationId,
        type: data.type,
        name: data.name,
        interval: data.interval,
        dayOfMonth: data.dayOfMonth,
        nextRunDate,
        templateData: JSON.stringify(data.templateData),
      },
    });

    // Audit entry
    await createAuditEntry({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "CREATE",
      entityType: "ORGANIZATION",
      entityId: template.id,
      newState: {
        name: template.name,
        type: template.type,
        interval: template.interval,
        dayOfMonth: template.dayOfMonth,
        nextRunDate: template.nextRunDate.toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...template,
          templateData: JSON.parse(template.templateData),
        },
      },
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

    console.error("Error creating recurring template:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
