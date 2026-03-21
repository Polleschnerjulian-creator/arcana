import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateTransactionCSV } from "@/lib/export/csv";

// ─── GET: Generic CSV Export ─────────────────────────────────────

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

    // Validate date format
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

    // Generate the CSV
    const csv = await generateTransactionCSV(
      session.user.organizationId,
      from,
      to
    );

    // Build filename
    const fromStr = fromParam.replace(/-/g, "");
    const toStr = toParam.replace(/-/g, "");
    const filename = `Buchungen_${fromStr}-${toStr}.csv`;

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
    console.error("Error generating CSV export:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
