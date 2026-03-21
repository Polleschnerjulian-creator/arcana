import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditEntry } from "@/lib/compliance/audit-log";
import { createWorker } from "tesseract.js";

// ─── POST: OCR mit Tesseract.js ─────────────────────────────────

export const maxDuration = 60; // Allow up to 60s for OCR processing

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

    // Check if already processed
    if (document.ocrStatus === "DONE") {
      return NextResponse.json({
        success: true,
        data: {
          id: document.id,
          ocrText: document.ocrText,
          ocrStatus: document.ocrStatus,
        },
      });
    }

    // PDF not yet supported
    if (document.mimeType === "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF-OCR wird in einer zukünftigen Version unterstützt. Bitte laden Sie ein Bild hoch.",
        },
        { status: 400 }
      );
    }

    // Verify storagePath is a URL we can fetch
    if (!document.storagePath.startsWith("http")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Datei nicht verfügbar. Bitte laden Sie das Dokument erneut hoch.",
        },
        { status: 400 }
      );
    }

    // Mark as processing
    await prisma.document.update({
      where: { id },
      data: { ocrStatus: "PROCESSING" },
    });

    // Fetch image from Vercel Blob
    let imageBuffer: Buffer;
    try {
      const response = await fetch(document.storagePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } catch (fetchError) {
      console.error("[OCR] Fehler beim Laden der Datei:", fetchError);
      await prisma.document.update({
        where: { id },
        data: { ocrStatus: "FAILED" },
      });
      return NextResponse.json(
        {
          success: false,
          error: "Datei konnte nicht geladen werden.",
        },
        { status: 500 }
      );
    }

    // Run Tesseract.js OCR
    let recognizedText: string;
    try {
      const worker = await createWorker("deu");
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      await worker.terminate();
      recognizedText = text;
    } catch (ocrError) {
      console.error("[OCR] Tesseract-Fehler:", ocrError);
      await prisma.document.update({
        where: { id },
        data: { ocrStatus: "FAILED" },
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "OCR-Verarbeitung fehlgeschlagen. Bitte versuchen Sie es erneut.",
        },
        { status: 500 }
      );
    }

    // Update document with recognized text
    const updated = await prisma.document.update({
      where: { id },
      data: {
        ocrText: recognizedText,
        ocrStatus: "DONE",
      },
    });

    // Audit entry (non-blocking)
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "DOCUMENT",
        entityId: id,
        newState: {
          ocrStatus: "DONE",
          ocrTextLength: recognizedText.length,
        },
      });
    } catch {
      // Audit-Modul nicht blockierend
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        ocrText: updated.ocrText,
        ocrStatus: updated.ocrStatus,
      },
    });
  } catch (error) {
    console.error("[OCR] Interner Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
