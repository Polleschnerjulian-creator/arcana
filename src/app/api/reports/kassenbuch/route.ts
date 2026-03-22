import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeKassenbuch } from "@/lib/accounting/kassenbuch";

// ─── GET: Kassenbuch Report ──────────────────────────────────────

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
    const accountParam = searchParams.get("account");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Validate date params
    if (!fromParam || !toParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter 'from' und 'to' sind erforderlich. Format: YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

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

    // Resolve account: use param or default to 1000 (Kasse)
    const accountNumber = accountParam || "1000";
    const account = await prisma.account.findUnique({
      where: {
        organizationId_number: {
          organizationId: session.user.organizationId,
          number: accountNumber,
        },
      },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: `Konto ${accountNumber} wurde nicht gefunden.`,
        },
        { status: 404 }
      );
    }

    const report = await computeKassenbuch(
      session.user.organizationId,
      account.id,
      from,
      to
    );

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error computing Kassenbuch:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
