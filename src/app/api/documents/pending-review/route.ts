import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET: Documents Pending User Review ────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;

    // Find documents that need review:
    // 1. OCR DONE + aiExtraction + linked DRAFT transaction (ready for confirm)
    // 2. OCR DONE + no aiExtraction (AI failed, needs manual booking)
    // 3. OCR FAILED (needs attention)
    // 4. Still PENDING/PROCESSING (pipeline running)
    const documents = await prisma.document.findMany({
      where: {
        organizationId,
        OR: [
          // Pipeline complete with DRAFT transaction
          {
            ocrStatus: "DONE",
            aiExtraction: { not: null },
            transactions: {
              some: { status: "DRAFT" },
            },
          },
          // OCR done but AI extraction failed
          {
            ocrStatus: "DONE",
            aiExtraction: null,
          },
          // OCR failed
          {
            ocrStatus: "FAILED",
          },
          // Pipeline still running
          {
            ocrStatus: { in: ["PENDING", "PROCESSING"] },
          },
        ],
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
        transactions: {
          where: { status: "DRAFT" },
          include: {
            lines: {
              include: {
                account: {
                  select: { id: true, number: true, name: true, type: true },
                },
              },
            },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Serialize for client
    const serialized = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      type: doc.type,
      ocrStatus: doc.ocrStatus,
      aiExtraction: doc.aiExtraction,
      uploadedAt: doc.uploadedAt.toISOString(),
      uploadedBy: doc.uploadedBy,
      transaction: doc.transactions[0]
        ? {
            id: doc.transactions[0].id,
            date: doc.transactions[0].date.toISOString(),
            description: doc.transactions[0].description,
            reference: doc.transactions[0].reference,
            status: doc.transactions[0].status,
            aiConfidence: doc.transactions[0].aiConfidence,
            lines: doc.transactions[0].lines.map((line) => ({
              id: line.id,
              accountId: line.accountId,
              debit: Number(line.debit),
              credit: Number(line.credit),
              taxRate: line.taxRate,
              note: line.note,
              account: line.account,
            })),
          }
        : null,
    }));

    return NextResponse.json({ success: true, data: serialized });
  } catch (error) {
    console.error("Error fetching pending review documents:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
