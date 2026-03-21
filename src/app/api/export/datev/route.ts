import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateDATEV } from "@/lib/export/datev";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── GET: DATEV Buchungsstapel Export ────────────────────────────

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
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Validate required parameters
    if (!fromParam || !toParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter 'from' und 'to' sind erforderlich. Format: YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    // Validate date format with strict regex before parsing
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    if (!DATE_REGEX.test(fromParam) || !DATE_REGEX.test(toParam)) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        {
          success: false,
          error: "'from' darf nicht nach 'to' liegen.",
        },
        { status: 400 }
      );
    }

    // Generate the DATEV CSV
    const csv = await generateDATEV(
      session.user.organizationId,
      from,
      to
    );

    // Build filename: EXTF_Buchungsstapel_YYYYMMDD-YYYYMMDD.csv
    const fromStr = fromParam.replace(/-/g, "");
    const toStr = toParam.replace(/-/g, "");
    const filename = `EXTF_Buchungsstapel_${fromStr}-${toStr}.csv`;

    // Create audit entry for the export
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "EXPORT",
        entityType: "TRANSACTION",
        entityId: `datev-export-${fromStr}-${toStr}`,
        newState: {
          format: "DATEV",
          from: fromParam,
          to: toParam,
          filename,
        },
      });
    } catch {
      // Audit log errors should not break the export
    }

    // Return as file download
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating DATEV export:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
