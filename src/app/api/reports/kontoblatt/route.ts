import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeKontoblatt } from "@/lib/accounting/kontoblatt";

// ─── GET: Kontoblatt Report ─────────────────────────────────────

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

    // Validate required parameters
    if (!accountParam || !fromParam || !toParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter 'account', 'from' und 'to' sind erforderlich.",
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
          error: "Ungueltiges Datumsformat. Erwartet: YYYY-MM-DD",
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
          error: "Ungueltiges Datumsformat. Erwartet: YYYY-MM-DD",
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

    // Look up account by number in the organization
    const account = await prisma.account.findUnique({
      where: {
        organizationId_number: {
          organizationId: session.user.organizationId,
          number: accountParam,
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: `Konto ${accountParam} nicht gefunden.`,
        },
        { status: 404 }
      );
    }

    const report = await computeKontoblatt(
      session.user.organizationId,
      account.id,
      account.type,
      from,
      to
    );

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error computing Kontoblatt:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
