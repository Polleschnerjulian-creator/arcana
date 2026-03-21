import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse."),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein."),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
  organizationName: z.string().min(2, "Firmenname muss mindestens 2 Zeichen lang sein."),
  legalForm: z.enum(["EU", "GmbH", "UG", "AG", "OHG", "KG", "GbR", "FreiBeruf"]),
});

// Top 20 most important SKR03 accounts for a new organization
const SKR03_DEFAULT_ACCOUNTS = [
  // ASSET accounts (Aktiva)
  { number: "0200", name: "Konzessionen", type: "ASSET", category: "ANLAGE" },
  { number: "0400", name: "Maschinen und Anlagen", type: "ASSET", category: "ANLAGE" },
  { number: "0420", name: "Büroeinrichtung", type: "ASSET", category: "ANLAGE" },
  { number: "0650", name: "Büromaschinen", type: "ASSET", category: "ANLAGE" },
  { number: "1200", name: "Bank", type: "ASSET", category: "UMLAUF" },
  { number: "1000", name: "Kasse", type: "ASSET", category: "UMLAUF" },
  { number: "1400", name: "Forderungen aus Lieferungen und Leistungen", type: "ASSET", category: "UMLAUF" },
  { number: "1576", name: "Vorsteuer 19%", type: "ASSET", category: "UMLAUF" },
  { number: "1571", name: "Vorsteuer 7%", type: "ASSET", category: "UMLAUF" },

  // LIABILITY accounts (Passiva)
  { number: "1600", name: "Verbindlichkeiten aus Lieferungen und Leistungen", type: "LIABILITY", category: "UMLAUF" },
  { number: "1776", name: "Umsatzsteuer 19%", type: "LIABILITY", category: "UMLAUF" },
  { number: "1771", name: "Umsatzsteuer 7%", type: "LIABILITY", category: "UMLAUF" },

  // EQUITY accounts (Eigenkapital)
  { number: "0800", name: "Gezeichnetes Kapital", type: "EQUITY", category: "EIGENKAPITAL" },
  { number: "0860", name: "Gewinnvortrag", type: "EQUITY", category: "EIGENKAPITAL" },

  // REVENUE accounts (Erlöse)
  { number: "8400", name: "Erlöse 19% USt", type: "REVENUE", category: "ERLOES" },
  { number: "8300", name: "Erlöse 7% USt", type: "REVENUE", category: "ERLOES" },
  { number: "8120", name: "Steuerfreie Erlöse", type: "REVENUE", category: "ERLOES" },

  // EXPENSE accounts (Aufwand)
  { number: "4100", name: "Löhne und Gehälter", type: "EXPENSE", category: "AUFWAND" },
  { number: "4200", name: "Soziale Abgaben", type: "EXPENSE", category: "AUFWAND" },
  { number: "6300", name: "Sonstige betriebliche Aufwendungen", type: "EXPENSE", category: "AUFWAND" },
] as const;

export async function POST(request: Request) {
  try {
    // Rate limiting: 5 attempts per IP per 15 minutes
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
    const { success: rateLimitOk } = rateLimit(
      `register:${ip}`,
      5,
      15 * 60 * 1000
    );

    if (!rateLimitOk) {
      return NextResponse.json(
        {
          success: false,
          error: "Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut.",
        },
        {
          status: 429,
          headers: { "Retry-After": "900" },
        }
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Ein Konto mit dieser E-Mail existiert bereits." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(data.password, 12);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          legalForm: data.legalForm,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          role: "OWNER",
          organizationId: organization.id,
        },
      });

      // Seed default SKR03 accounts for the new organization
      await tx.account.createMany({
        data: SKR03_DEFAULT_ACCOUNTS.map((account) => ({
          organizationId: organization.id,
          number: account.number,
          name: account.name,
          type: account.type,
          category: account.category,
          isSystem: true,
          isActive: true,
        })),
      });

      return { organization, user };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            organizationId: result.user.organizationId,
          },
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            legalForm: result.organization.legalForm,
          },
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

    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
