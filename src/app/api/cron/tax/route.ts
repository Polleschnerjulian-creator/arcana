import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─── GET: UStVA Auto-Calculation (Quarterly) ────────────────────
// Runs on the 1st of Jan/Apr/Jul/Oct. Calculates USt, VSt,
// and Zahllast for the previous quarter and stores a TaxPeriod.

const UST_ACCOUNTS: Record<string, string[]> = {
  SKR03: ["1776", "1771"],
  SKR04: ["3806", "3801"],
};

const VST_ACCOUNTS: Record<string, string[]> = {
  SKR03: ["1576", "1571"],
  SKR04: ["1406", "1401"],
};

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  // Check if a quarter just ended (Jan=Q4 of prev year, Apr=Q1, Jul=Q2, Oct=Q3)
  const isQuarterStart = [0, 3, 6, 9].includes(currentMonth);
  if (!isQuarterStart) {
    return NextResponse.json({
      success: true,
      message: "Kein Quartalsende",
      processed: 0,
    });
  }

  // Calculate previous quarter date range
  const prevQuarterEnd = new Date(currentYear, currentMonth, 0); // Last day of previous month
  const prevQuarterStart = new Date(currentYear, currentMonth - 3, 1);

  let processed = 0;
  const errors: { orgId: string; error: string }[] = [];

  try {
    // For each organization, calculate USt/VSt
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, chartOfAccounts: true },
    });

    for (const org of orgs) {
      try {
        // Check if TaxPeriod already exists for this quarter
        const existing = await prisma.taxPeriod.findFirst({
          where: {
            organizationId: org.id,
            periodStart: prevQuarterStart,
            periodEnd: prevQuarterEnd,
          },
        });

        if (existing) continue;

        const chart = org.chartOfAccounts ?? "SKR03";
        const ustAccountNumbers = UST_ACCOUNTS[chart] ?? UST_ACCOUNTS.SKR03;
        const vstAccountNumbers = VST_ACCOUNTS[chart] ?? VST_ACCOUNTS.SKR03;

        // Query transaction lines for the quarter
        const ustLines = await prisma.transactionLine.findMany({
          where: {
            transaction: {
              organizationId: org.id,
              status: "BOOKED",
              date: { gte: prevQuarterStart, lte: prevQuarterEnd },
            },
            account: { number: { in: ustAccountNumbers } },
          },
        });

        const vstLines = await prisma.transactionLine.findMany({
          where: {
            transaction: {
              organizationId: org.id,
              status: "BOOKED",
              date: { gte: prevQuarterStart, lte: prevQuarterEnd },
            },
            account: { number: { in: vstAccountNumbers } },
          },
        });

        const ustAmount = ustLines.reduce(
          (sum, l) => sum + Number(l.credit) - Number(l.debit),
          0
        );
        const vstAmount = vstLines.reduce(
          (sum, l) => sum + Number(l.debit) - Number(l.credit),
          0
        );
        const payloadAmount = ustAmount - vstAmount; // Zahllast

        await prisma.taxPeriod.create({
          data: {
            organizationId: org.id,
            type: "USTVA_QUARTERLY",
            periodStart: prevQuarterStart,
            periodEnd: prevQuarterEnd,
            ustAmount,
            vstAmount,
            payloadAmount,
            status: "CALCULATED",
          },
        });

        console.log(
          `[Cron/Tax] UStVA berechnet fuer ${org.name}: USt=${ustAmount.toFixed(2)}, VSt=${vstAmount.toFixed(2)}, Zahllast=${payloadAmount.toFixed(2)}`
        );

        processed++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Cron/Tax] Fehler bei Organisation ${org.name} (${org.id}):`,
          message
        );
        errors.push({ orgId: org.id, error: message });
      }
    }

    console.log(
      `[Cron/Tax] Abgeschlossen: ${processed} berechnet, ${errors.length} Fehler`
    );

    return NextResponse.json({ success: true, processed, errors });
  } catch (error) {
    console.error("[Cron/Tax] Fataler Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler.", processed, errors },
      { status: 500 }
    );
  }
}
