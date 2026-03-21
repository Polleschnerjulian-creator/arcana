import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: List Webhook Logs ─────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Authenticated via session (not API key) — this is an admin view
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10) || 50,
      200
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (source) {
      where.source = source;
    }

    if (status && ["RECEIVED", "PROCESSED", "FAILED"].includes(status)) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          source: true,
          event: true,
          payload: true,
          status: true,
          errorMessage: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      prisma.webhookLog.count({ where }),
    ]);

    // Parse payload JSON and truncate for preview
    const serialized = logs.map((log) => {
      let payloadPreview: unknown = null;
      try {
        const parsed = JSON.parse(log.payload);
        // Show only the event/source + data keys for preview
        payloadPreview = {
          event: parsed.event,
          source: parsed.source,
          dataKeys: parsed.data ? Object.keys(parsed.data) : [],
        };
      } catch {
        payloadPreview = "(Ungültiges JSON)";
      }

      return {
        ...log,
        payloadPreview,
        payload: undefined, // Don't send full payload in list view
      };
    });

    return NextResponse.json({
      success: true,
      data: serialized,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Webhook logs GET error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
