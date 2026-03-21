import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: Notification Counts ───────────────────────────────────
// Returns counts of items that need attention across the platform.

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const orgId = session.user.organizationId;

    // Run all count queries in parallel
    const [
      pendingDocuments,
      failedDocuments,
      unmatchedBankTransactions,
      overdueInvoices,
      draftTransactions,
    ] = await Promise.all([
      // Documents with ocrStatus PENDING or PROCESSING
      prisma.document.count({
        where: {
          organizationId: orgId,
          ocrStatus: { in: ["PENDING", "PROCESSING"] },
        },
      }),

      // Documents with ocrStatus FAILED
      prisma.document.count({
        where: {
          organizationId: orgId,
          ocrStatus: "FAILED",
        },
      }),

      // Bank transactions with status UNMATCHED
      prisma.bankTransaction.count({
        where: {
          matchStatus: "UNMATCHED",
          bankAccount: { organizationId: orgId },
        },
      }),

      // Invoices with status OVERDUE
      prisma.invoice.count({
        where: {
          organizationId: orgId,
          status: "OVERDUE",
        },
      }),

      // Transactions with status DRAFT (need review)
      prisma.transaction.count({
        where: {
          organizationId: orgId,
          status: "DRAFT",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pendingDocuments,
        failedDocuments,
        unmatchedBankTransactions,
        overdueInvoices,
        draftTransactions,
      },
    });
  } catch (error) {
    console.error("Error fetching notification counts:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
