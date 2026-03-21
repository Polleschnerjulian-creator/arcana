import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Zod Schema ──────────────────────────────────────────────────

const createBankAccountSchema = z.object({
  name: z
    .string()
    .min(2, "Name muss mindestens 2 Zeichen lang sein.")
    .max(120, "Name darf maximal 120 Zeichen lang sein."),
  iban: z
    .string()
    .regex(
      /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/,
      "Ungültiges IBAN-Format."
    )
    .optional()
    .nullable(),
  bic: z
    .string()
    .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Ungültiges BIC-Format.")
    .optional()
    .nullable(),
  accountId: z.string().min(1, "Verknüpftes Konto ist erforderlich."),
});

// ─── GET: List Bank Accounts ─────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        account: {
          select: { id: true, number: true, name: true, type: true },
        },
        _count: {
          select: { bankTransactions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: bankAccounts });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create Bank Account ───────────────────────────────────

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
    const data = createBankAccountSchema.parse(body);

    // Prüfen, ob das verknüpfte Konto existiert und zur Organisation gehört
    const account = await prisma.account.findFirst({
      where: {
        id: data.accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "Das verknüpfte Konto wurde nicht gefunden oder gehört nicht zu Ihrer Organisation.",
        },
        { status: 400 }
      );
    }

    // Prüfen, ob das Konto bereits mit einem Bankkonto verknüpft ist
    const existingBankAccount = await prisma.bankAccount.findUnique({
      where: { accountId: data.accountId },
    });

    if (existingBankAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Konto ${account.number} (${account.name}) ist bereits mit einem Bankkonto verknüpft.`,
        },
        { status: 409 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        organizationId: session.user.organizationId,
        name: data.name,
        iban: data.iban || null,
        bic: data.bic || null,
        accountId: data.accountId,
      },
      include: {
        account: {
          select: { id: true, number: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: bankAccount },
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

    console.error("Error creating bank account:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
