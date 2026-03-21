import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createAccountSchema = z.object({
  number: z
    .string()
    .min(4, "Kontonummer muss mindestens 4 Zeichen haben.")
    .max(6, "Kontonummer darf maximal 6 Zeichen haben.")
    .regex(/^\d+$/, "Kontonummer darf nur Ziffern enthalten."),
  name: z
    .string()
    .min(2, "Kontoname muss mindestens 2 Zeichen lang sein.")
    .max(120, "Kontoname darf maximal 120 Zeichen lang sein."),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], {
    message: "Ungültiger Kontotyp.",
  }),
  category: z.enum(["ANLAGE", "UMLAUF", "EIGENKAPITAL", "ERLOES", "AUFWAND"], {
    message: "Ungültige Kategorie.",
  }),
});

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
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (type) {
      where.type = type;
    }

    if (active !== null && active !== undefined && active !== "") {
      where.isActive = active === "true";
    }

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { number: "asc" },
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

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
    const data = createAccountSchema.parse(body);

    // Check for duplicate account number within the organization
    const existingAccount = await prisma.account.findUnique({
      where: {
        organizationId_number: {
          organizationId: session.user.organizationId,
          number: data.number,
        },
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Kontonummer ${data.number} existiert bereits.`,
        },
        { status: 409 }
      );
    }

    const account = await prisma.account.create({
      data: {
        organizationId: session.user.organizationId,
        number: data.number,
        name: data.name,
        type: data.type,
        category: data.category,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, data: account },
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

    console.error("Error creating account:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
