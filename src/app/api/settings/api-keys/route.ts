import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/api-auth";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Zod Schemas ────────────────────────────────────────────────

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name ist erforderlich.")
    .max(100, "Name darf maximal 100 Zeichen lang sein."),
  permissions: z.enum(["webhook", "full_read", "full_write"], {
    message: "Berechtigung muss 'webhook', 'full_read' oder 'full_write' sein.",
  }),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD")
    .optional()
    .nullable(),
});

// ─── GET: List API Keys ─────────────────────────────────────────

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
    const activeOnly = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    const apiKeys = await prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        // NEVER return keyHash
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: apiKeys });
  } catch (error) {
    console.error("API Keys GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Create API Key ───────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can create API keys
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung. Nur Eigentümer und Administratoren können API-Schlüssel erstellen." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createApiKeySchema.parse(body);

    // Generate the API key
    const { key, keyHash, keyPrefix } = generateApiKey();

    // Parse expiration date if provided
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      return NextResponse.json(
        { success: false, error: "Ablaufdatum muss in der Zukunft liegen." },
        { status: 400 }
      );
    }

    // Create the API key record (store only the hash, never plaintext)
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: session.user.organizationId,
        name: data.name,
        keyHash,
        keyPrefix,
        permissions: data.permissions,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "ORGANIZATION",
        entityId: apiKey.id,
        newState: {
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
        },
      });
    } catch {
      // Audit failure should not break the flow
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...apiKey,
          // Return the FULL KEY only once — user must save it now
          key,
        },
        warning:
          "Speichern Sie diesen API-Schlüssel jetzt! Er wird nicht erneut angezeigt.",
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

    console.error("API Keys POST error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
