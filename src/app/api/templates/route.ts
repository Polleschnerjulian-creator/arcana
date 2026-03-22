import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Default Templates (hardcoded, available to all orgs) ────────

const DEFAULT_TEMPLATES = [
  {
    id: "default-miete",
    name: "Miete buchen",
    description: "Monatliche Büromiete",
    templateLines: JSON.stringify([
      { accountNumber: "4210", debit: true, credit: false, taxRate: null },
      { accountNumber: "1200", debit: false, credit: true, taxRate: null },
    ]),
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-bueromaterial",
    name: "Büromaterial",
    description: "Bürobedarf mit Vorsteuer",
    templateLines: JSON.stringify([
      { accountNumber: "4820", debit: true, credit: false, taxRate: 19 },
      { accountNumber: "1200", debit: false, credit: true, taxRate: null },
    ]),
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-telefon",
    name: "Telefonkosten",
    description: "Telefon- und Internetkosten mit Vorsteuer",
    templateLines: JSON.stringify([
      { accountNumber: "4805", debit: true, credit: false, taxRate: 19 },
      { accountNumber: "1200", debit: false, credit: true, taxRate: null },
    ]),
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-gehalt",
    name: "Gehalt",
    description: "Monatliche Gehaltszahlung",
    templateLines: JSON.stringify([
      { accountNumber: "4120", debit: true, credit: false, taxRate: null },
      { accountNumber: "1200", debit: false, credit: true, taxRate: null },
    ]),
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
];

// ─── GET: List templates ────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Fetch custom templates from DB
    const customTemplates = await prisma.bookingTemplate.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    });

    // Combine defaults + custom
    const templates = [
      ...DEFAULT_TEMPLATES,
      ...customTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        templateLines: t.templateLines,
        isDefault: t.isDefault,
        usageCount: t.usageCount,
        createdAt: t.createdAt.toISOString(),
      })),
    ];

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create a custom template ────────────────────────────

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
    const { name, description, lines } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Name ist erforderlich." },
        { status: 400 }
      );
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "Mindestens eine Buchungszeile ist erforderlich." },
        { status: 400 }
      );
    }

    // Validate line structure
    for (const line of lines) {
      if (!line.accountNumber || typeof line.accountNumber !== "string") {
        return NextResponse.json(
          { success: false, error: "Jede Zeile benötigt eine Kontonummer." },
          { status: 400 }
        );
      }
    }

    const template = await prisma.bookingTemplate.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        templateLines: JSON.stringify(lines),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        templateLines: template.templateLines,
        isDefault: template.isDefault,
        usageCount: template.usageCount,
        createdAt: template.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
