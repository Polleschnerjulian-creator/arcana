import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteDocument } from "@/lib/documents/storage";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── GET: Get Single Document ───────────────────────────────────

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
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
        transactions: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            status: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Beleg nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete Document ────────────────────────────────────

export async function DELETE(
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
      include: {
        transactions: {
          select: { id: true, status: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Beleg nicht gefunden." },
        { status: 404 }
      );
    }

    // Prüfe ob der Beleg mit einer gebuchten Transaktion verknüpft ist
    const hasBookedTransaction = document.transactions.some(
      (tx) => tx.status === "BOOKED"
    );

    if (hasBookedTransaction) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Beleg kann nicht gelöscht werden, da er mit einer gebuchten Transaktion verknüpft ist.",
        },
        { status: 409 }
      );
    }

    // Datei vom Dateisystem entfernen
    try {
      await deleteDocument(document.storagePath);
    } catch {
      // Datei existiert möglicherweise nicht mehr — trotzdem DB-Eintrag löschen
      console.warn(
        `Datei nicht gefunden beim Löschen: ${document.storagePath}`
      );
    }

    // DB-Eintrag löschen
    await prisma.document.delete({
      where: { id },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "DELETE",
        entityType: "DOCUMENT",
        entityId: id,
        previousState: {
          fileName: document.fileName,
          type: document.type,
          sha256Hash: document.sha256Hash,
        },
      });
    } catch {
      // Audit-Fehler unterbricht den Hauptablauf nicht
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
