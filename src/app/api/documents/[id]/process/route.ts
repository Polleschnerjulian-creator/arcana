import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runDocumentPipeline } from "@/lib/documents/auto-pipeline";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ success: false, error: "Nicht authentifiziert." }, { status: 401 });
    }

    const { id: documentId } = await params;
    const orgId = session.user.organizationId;

    // Verify document belongs to org
    const doc = await prisma.document.findFirst({
      where: { id: documentId, organizationId: orgId },
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: "Beleg nicht gefunden." }, { status: 404 });
    }

    // Run the full pipeline synchronously in this request (maxDuration 60s)
    await runDocumentPipeline(documentId, orgId);

    // Fetch updated document
    const updated = await prisma.document.findUnique({
      where: { id: documentId },
      select: { ocrStatus: true, aiExtraction: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        ocrStatus: updated?.ocrStatus,
        hasExtraction: !!updated?.aiExtraction,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Document Process]", msg);
    return NextResponse.json(
      { success: false, error: "Verarbeitung fehlgeschlagen." },
      { status: 500 }
    );
  }
}
