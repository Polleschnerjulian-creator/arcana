import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  previewJahresabschluss,
  performJahresabschluss,
} from "@/lib/accounting/jahresabschluss";

// ─── GET: Preview Jahresabschluss ───────────────────────────────

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

    if (!yearParam) {
      return NextResponse.json(
        { success: false, error: "Parameter 'year' ist erforderlich." },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: "Ungueltiges Jahr." },
        { status: 400 }
      );
    }

    const preview = await previewJahresabschluss(
      session.user.organizationId,
      year
    );

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    console.error("Error previewing Jahresabschluss:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Execute Jahresabschluss ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can perform year-end closing
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nur Inhaber und Administratoren koennen den Jahresabschluss durchfuehren.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const year = body.year;

    if (!year || typeof year !== "number" || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: "Ungueltiges Jahr." },
        { status: 400 }
      );
    }

    // Require explicit confirmation
    if (body.confirmed !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bestaetigung erforderlich. Der Jahresabschluss ist unwiderruflich.",
        },
        { status: 400 }
      );
    }

    const result = await performJahresabschluss(
      session.user.organizationId,
      year,
      session.user.id
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("bereits durchgefuehrt")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    console.error("Error performing Jahresabschluss:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
