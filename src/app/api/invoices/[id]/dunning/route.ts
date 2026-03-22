import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  getDunningLevel,
  generateDunningHTML,
  type DunningInvoice,
  type DunningOrgData,
} from "@/lib/invoices/dunning";

// ─── GET: Dunning history for an invoice ─────────────────────────

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

    // Verify invoice belongs to this organization
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      select: { id: true, dueDate: true, status: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    const entries = await prisma.dunningEntry.findMany({
      where: {
        invoiceId: id,
        organizationId: session.user.organizationId,
      },
      orderBy: { sentAt: "asc" },
    });

    // Determine next dunning level
    const nextLevel = getDunningLevel(
      { dueDate: invoice.dueDate, status: invoice.status },
      entries.length
    );

    return NextResponse.json({
      success: true,
      data: {
        entries: entries.map((e) => ({
          ...e,
          fee: Number(e.fee),
        })),
        nextLevel,
      },
    });
  } catch (error) {
    console.error("Error fetching dunning history:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Send a dunning reminder ──────────────────────────────

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const email: string | undefined = body?.email;
    const customFee: number | undefined = body?.fee;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "E-Mail-Adresse erforderlich." },
        { status: 400 }
      );
    }

    // Fetch invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden." },
        { status: 404 }
      );
    }

    if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
      return NextResponse.json(
        {
          success: false,
          error: `Mahnung kann nur für offene Rechnungen erstellt werden. Aktueller Status: ${invoice.status}.`,
        },
        { status: 400 }
      );
    }

    // Get existing entries to determine level
    const existingEntries = await prisma.dunningEntry.findMany({
      where: {
        invoiceId: id,
        organizationId: session.user.organizationId,
      },
    });

    const levelInfo = getDunningLevel(
      { dueDate: invoice.dueDate, status: invoice.status },
      existingEntries.length
    );

    // Allow custom fee override (e.g., 0 to waive fee)
    const fee = customFee !== undefined ? customFee : levelInfo.suggestedFee;

    // Fetch org data
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        name: true,
        street: true,
        city: true,
        zip: true,
        ustId: true,
        taxId: true,
        settings: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: "Organisation nicht gefunden." },
        { status: 404 }
      );
    }

    // Parse org settings for bank details
    let bankName: string | undefined;
    let bankIban: string | undefined;
    let bankBic: string | undefined;
    if (org.settings) {
      try {
        const parsed = JSON.parse(org.settings);
        const invoiceSettings = parsed.invoice || {};
        bankName = invoiceSettings.bankName;
        bankIban = invoiceSettings.bankIban;
        bankBic = invoiceSettings.bankBic;
      } catch {
        // Ignore corrupted JSON
      }
    }

    const dunningInvoice: DunningInvoice = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerAddress: invoice.customerAddress || undefined,
      dueDate: invoice.dueDate,
      total: Number(invoice.total),
      status: invoice.status,
    };

    const dunningOrg: DunningOrgData = {
      name: org.name,
      street: org.street || undefined,
      city: org.city || undefined,
      zip: org.zip || undefined,
      ustId: org.ustId || undefined,
      taxId: org.taxId || undefined,
      bankName,
      bankIban,
      bankBic,
    };

    // Generate dunning HTML
    const htmlContent = generateDunningHTML(
      dunningInvoice,
      dunningOrg,
      levelInfo.level,
      fee,
      levelInfo.newDueDate
    );

    // Send email
    const emailResult = await sendEmail({
      to: email,
      subject: `${levelInfo.label} - Rechnung ${invoice.invoiceNumber}`,
      html: htmlContent,
    });

    // Create dunning entry regardless of email success (letter was generated)
    const entry = await prisma.dunningEntry.create({
      data: {
        organizationId: session.user.organizationId,
        invoiceId: id,
        level: levelInfo.level,
        dueDate: levelInfo.newDueDate,
        fee,
      },
    });

    // Update invoice status to OVERDUE if not already
    if (invoice.status === "SENT") {
      await prisma.invoice.update({
        where: { id },
        data: { status: "OVERDUE" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        entry: {
          ...entry,
          fee: Number(entry.fee),
        },
        level: levelInfo,
        emailSent: emailResult.success,
        emailError: emailResult.error,
      },
    });
  } catch (error) {
    console.error("Error sending dunning reminder:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
