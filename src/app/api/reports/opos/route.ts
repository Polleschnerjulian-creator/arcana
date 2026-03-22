import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeOPOS } from "@/lib/accounting/opos";

// ─── GET: OPOS Report ────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const report = await computeOPOS(session.user.organizationId);

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error computing OPOS:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
