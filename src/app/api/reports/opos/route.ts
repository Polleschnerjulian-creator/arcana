import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeOPOS, computeKreditorenOPOS } from "@/lib/accounting/opos";

// ─── GET: OPOS Report ────────────────────────────────────────────
// Supports ?type=debitoren (default) or ?type=kreditoren

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "debitoren";

    if (type === "kreditoren") {
      const report = await computeKreditorenOPOS(session.user.organizationId);
      return NextResponse.json({ success: true, type: "kreditoren", data: report });
    }

    const report = await computeOPOS(session.user.organizationId);
    return NextResponse.json({ success: true, type: "debitoren", data: report });
  } catch (error) {
    console.error("Error computing OPOS:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
