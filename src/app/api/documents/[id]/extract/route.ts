import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractDocumentData } from "@/lib/ai/extract";

// ─── POST: KI-Extraktion starten ────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify document belongs to user's organization
    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Dokument nicht gefunden." },
        { status: 404 }
      );
    }

    // Check OCR status
    if (!document.ocrText || document.ocrStatus !== "DONE") {
      return NextResponse.json(
        {
          success: false,
          error: "Texterkennung noch nicht abgeschlossen. Bitte zuerst Texterkennung starten.",
        },
        { status: 400 }
      );
    }

    // Run AI extraction
    const extraction = await extractDocumentData(document.ocrText);

    if (!extraction) {
      // Log actual reason server-side only — never reveal config state to client
      console.error("[AI Extract]", "extraction returned null");
      return NextResponse.json(
        { success: false, error: "KI-Extraktion ist derzeit nicht verfügbar." },
        { status: 503 }
      );
    }

    // Save extraction result
    const updated = await prisma.document.update({
      where: { id },
      data: {
        aiExtraction: JSON.stringify(extraction),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        aiExtraction: extraction,
      },
    });
  } catch (error) {
    console.error("Error extracting document data:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
