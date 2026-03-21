import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentPath } from "@/lib/documents/storage";

// ─── GET: Serve Document File ───────────────────────────────────

export async function GET(
  _request: NextRequest,
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

    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Beleg nicht gefunden." },
        { status: 404 }
      );
    }

    // Datei lesen
    const filePath = getDocumentPath(document.storagePath);
    let fileBuffer: Buffer;

    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      return NextResponse.json(
        { success: false, error: "Datei nicht gefunden." },
        { status: 404 }
      );
    }

    // Dateiname für Content-Disposition bereinigen
    const safeFileName = document.fileName.replace(/[^\w.-]/g, "_");

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${safeFileName}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving document file:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
