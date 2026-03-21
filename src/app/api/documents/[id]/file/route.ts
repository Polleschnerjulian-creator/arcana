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

    // Blob-URL: Redirect direkt zur Cloud-Datei
    if (document.storagePath.startsWith("http")) {
      return NextResponse.redirect(document.storagePath);
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
