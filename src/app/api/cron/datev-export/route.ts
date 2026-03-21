import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDATEV } from "@/lib/export/datev";
import { put } from "@vercel/blob";

// ─── GET: DATEV Auto-Export (Monthly) ───────────────────────────
// Runs on the 5th of each month. Generates the previous month's
// DATEV Buchungsstapel export and stores it in Vercel Blob.

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthStart = new Date(
    prevMonthEnd.getFullYear(),
    prevMonthEnd.getMonth(),
    1
  );

  let processed = 0;
  const errors: { orgId: string; error: string }[] = [];

  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    for (const org of orgs) {
      try {
        const datevCsv = await generateDATEV(
          org.id,
          prevMonthStart,
          prevMonthEnd
        );

        if (!datevCsv || datevCsv.trim().length < 100) continue; // Keine Buchungsdaten

        const monthStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, "0")}`;
        const blob = await put(
          `exports/${org.id}/DATEV-${monthStr}.csv`,
          datevCsv,
          { access: "private", contentType: "text/csv", token: process.env.BLOB_READ_WRITE_TOKEN! }
        );

        console.log(
          `[Cron/DATEV-Export] ${org.name}: ${monthStr} exportiert → ${blob.url}`
        );

        processed++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Cron/DATEV-Export] Fehler bei ${org.name} (${org.id}):`,
          message
        );
        errors.push({ orgId: org.id, error: message });
      }
    }

    console.log(
      `[Cron/DATEV-Export] Abgeschlossen: ${processed} exportiert, ${errors.length} Fehler`
    );

    return NextResponse.json({ success: true, processed, errors });
  } catch (error) {
    console.error("[Cron/DATEV-Export] Fataler Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler.", processed, errors },
      { status: 500 }
    );
  }
}
