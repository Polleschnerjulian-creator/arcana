import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── POST: Dismiss an inbox item ─────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId || !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const orgId = session.user.organizationId;
    const userId = session.user.id;
    const body = await request.json();
    const { type, sourceId } = body as { type: string; sourceId: string };

    if (!type || !sourceId) {
      return NextResponse.json(
        { success: false, error: "type und sourceId sind erforderlich." },
        { status: 400 }
      );
    }

    // ─── DOCUMENT: Delete draft, keep document ────────────────
    if (type === "DOCUMENT" || type === "EMAIL_IMPORT") {
      // Find and delete the DRAFT transaction linked to this document
      const draftTx = await prisma.transaction.findFirst({
        where: {
          id: sourceId,
          organizationId: orgId,
          status: "DRAFT",
        },
      });

      if (draftTx) {
        // Delete transaction lines first, then transaction
        await prisma.$transaction([
          prisma.transactionLine.deleteMany({
            where: { transactionId: draftTx.id },
          }),
          prisma.transaction.delete({
            where: { id: draftTx.id },
          }),
        ]);

        // Audit log
        try {
          await createAuditEntry({
            organizationId: orgId,
            userId,
            action: "DELETE",
            entityType: "TRANSACTION",
            entityId: draftTx.id,
            previousState: {
              source: "INBOX_DISMISS",
              inboxItemId: id,
              status: "DRAFT",
            },
          });
        } catch {
          // Non-blocking
        }
      }

      return NextResponse.json({
        success: true,
        data: { dismissed: true },
      });
    }

    // ─── BANK_TRANSACTION: Mark as reviewed (skip in inbox) ───
    if (type === "BANK_TRANSACTION") {
      const bankTx = await prisma.bankTransaction.findFirst({
        where: {
          id: sourceId,
          bankAccount: { organizationId: orgId },
        },
      });

      if (!bankTx) {
        return NextResponse.json(
          { success: false, error: "Bankumsatz nicht gefunden." },
          { status: 404 }
        );
      }

      // Mark as MANUAL (reviewed, no match) to skip in inbox
      await prisma.bankTransaction.update({
        where: { id: bankTx.id },
        data: { matchStatus: "MANUAL" },
      });

      // Audit log
      try {
        await createAuditEntry({
          organizationId: orgId,
          userId,
          action: "UPDATE",
          entityType: "BANK_TRANSACTION",
          entityId: bankTx.id,
          previousState: { matchStatus: bankTx.matchStatus },
          newState: { matchStatus: "MANUAL", source: "INBOX_DISMISS" },
        });
      } catch {
        // Non-blocking
      }

      return NextResponse.json({
        success: true,
        data: { dismissed: true },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unbekannter Typ: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Inbox Dismiss] Error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
