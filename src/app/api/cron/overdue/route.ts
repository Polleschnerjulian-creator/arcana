import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─── GET: Mark overdue invoices ─────────────────────────────────
// Triggered by Vercel Cron or manually. Finds all SENT invoices
// past their due date and updates them to OVERDUE status.

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all SENT invoices past due date and mark as OVERDUE
    const overdue = await prisma.invoice.updateMany({
      where: {
        status: "SENT",
        dueDate: { lt: new Date() },
      },
      data: { status: "OVERDUE" },
    });

    console.log(`[Cron/Overdue] Updated ${overdue.count} invoices to OVERDUE`);

    return NextResponse.json({ success: true, updated: overdue.count });
  } catch (error) {
    console.error("[Cron/Overdue] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
