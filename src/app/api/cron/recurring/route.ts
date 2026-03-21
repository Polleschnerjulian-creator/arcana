import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Helpers ────────────────────────────────────────────────────

function getNextDate(
  current: Date,
  interval: string,
  dayOfMonth: number
): Date {
  const next = new Date(current);
  if (interval === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (interval === "QUARTERLY") next.setMonth(next.getMonth() + 3);
  else if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  // Clamp dayOfMonth to the actual number of days in the target month
  const daysInMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();
  next.setDate(Math.min(dayOfMonth, daysInMonth));
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ─── Invoice Creation ───────────────────────────────────────────

async function createInvoiceFromTemplate(
  organizationId: string,
  templateData: {
    customerName: string;
    customerAddress?: string | null;
    taxRate: number;
    lineItems: { description: string; quantity: number; unitPrice: number }[];
  }
) {
  const lineItems = templateData.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));

  const subtotal =
    Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) /
    100;
  const taxAmount =
    Math.round(subtotal * (templateData.taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const today = new Date();
  const issueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);

  const year = today.getFullYear();

  const invoice = await prisma.$transaction(async (tx) => {
    // Generate sequential invoice number
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

    return tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        customerName: templateData.customerName,
        customerAddress: templateData.customerAddress || null,
        issueDate,
        dueDate,
        status: "DRAFT",
        lineItems: JSON.stringify(lineItems),
        subtotal,
        taxAmount,
        total,
      },
    });
  });

  return invoice;
}

// ─── Transaction Creation ───────────────────────────────────────

async function createTransactionFromTemplate(
  organizationId: string,
  templateData: {
    description: string;
    reference?: string | null;
    lines: { accountId: string; debit: number; credit: number }[];
  }
) {
  const today = new Date();
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const transaction = await prisma.transaction.create({
    data: {
      organizationId,
      date,
      description: templateData.description,
      reference: templateData.reference || null,
      status: "DRAFT",
      source: "RECURRING",
      lines: {
        create: templateData.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
        })),
      },
    },
  });

  return transaction;
}

// ─── GET: Cron Job ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: { templateId: string; name: string; error: string }[] = [];
  let processed = 0;

  try {
    const now = new Date();

    // Find all active templates where nextRunDate <= now
    const templates = await prisma.recurringTemplate.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: now },
      },
    });

    console.log(
      `[Cron/Recurring] Found ${templates.length} templates to process`
    );

    for (const template of templates) {
      try {
        const templateData = JSON.parse(template.templateData);
        let entityId = "";
        let entityType: "INVOICE" | "TRANSACTION" = "INVOICE";

        if (template.type === "INVOICE") {
          const invoice = await createInvoiceFromTemplate(
            template.organizationId,
            templateData
          );
          entityId = invoice.id;
          entityType = "INVOICE";

          console.log(
            `[Cron/Recurring] Created invoice ${invoice.invoiceNumber} from template "${template.name}"`
          );
        } else if (template.type === "TRANSACTION") {
          const transaction = await createTransactionFromTemplate(
            template.organizationId,
            templateData
          );
          entityId = transaction.id;
          entityType = "TRANSACTION";

          console.log(
            `[Cron/Recurring] Created transaction ${transaction.id} from template "${template.name}"`
          );
        }

        // Update template: lastRunDate = now, nextRunDate = next date
        const nextRunDate = getNextDate(
          now,
          template.interval,
          template.dayOfMonth
        );

        await prisma.recurringTemplate.update({
          where: { id: template.id },
          data: {
            lastRunDate: now,
            nextRunDate,
          },
        });

        // Audit entry for the created entity
        await createAuditEntry({
          organizationId: template.organizationId,
          userId: "SYSTEM",
          action: "CREATE",
          entityType,
          entityId,
          newState: {
            source: "recurring",
            templateId: template.id,
            templateName: template.name,
            executedAt: now.toISOString(),
            nextRunDate: formatDate(nextRunDate),
          },
        });

        processed++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Cron/Recurring] Failed to process template "${template.name}" (${template.id}):`,
          message
        );
        errors.push({
          templateId: template.id,
          name: template.name,
          error: message,
        });
      }
    }

    console.log(
      `[Cron/Recurring] Completed: ${processed} processed, ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      processed,
      errors,
    });
  } catch (error) {
    console.error("[Cron/Recurring] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler.", processed, errors },
      { status: 500 }
    );
  }
}
