import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeBWA } from "@/lib/accounting/bwa";

// ─── GET: BWA Report ─────────────────────────────────────────────

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
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    // Validate required parameters
    if (!yearParam || !monthParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter 'year' und 'month' sind erforderlich.",
        },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültiges Jahr. Erwartet: 2000-2100",
        },
        { status: 400 }
      );
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        {
          success: false,
          error: "Ungültiger Monat. Erwartet: 1-12",
        },
        { status: 400 }
      );
    }

    const report = await computeBWA(
      session.user.organizationId,
      year,
      month
    );

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error computing BWA:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
