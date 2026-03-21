import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Proxy file through server to avoid exposing blob URLs to client
    if (document.storagePath.startsWith("http")) {
      try {
        const blobResponse = await fetch(document.storagePath);
        if (!blobResponse.ok) {
          return NextResponse.json(
            { success: false, error: "Datei konnte nicht geladen werden." },
            { status: 502 }
          );
        }

        const fileBuffer = await blobResponse.arrayBuffer();
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": document.mimeType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${document.fileName}"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      } catch (fetchError) {
        console.error("Error proxying document file:", fetchError);
        return NextResponse.json(
          { success: false, error: "Datei konnte nicht geladen werden." },
          { status: 502 }
        );
      }
    }

    // Lokaler Pfad (Legacy): Datei nicht mehr verfügbar nach Migration
    return NextResponse.json(
      {
        success: false,
        error:
          "Datei nicht mehr verfügbar (Migration zu Cloud-Speicher)",
      },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error serving document file:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
