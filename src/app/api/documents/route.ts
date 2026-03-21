import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveDocument } from "@/lib/documents/storage";
import { createAuditEntry } from "@/lib/compliance/audit-log";

// ─── Constants ──────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_TYPES = [
  "INCOMING_INVOICE",
  "OUTGOING_INVOICE",
  "RECEIPT",
  "BANK_STATEMENT",
  "OTHER",
] as const;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

// ─── GET: List Documents ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (type && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      where.type = type;
    }

    if (status) {
      where.ocrStatus = status;
    }

    if (search) {
      where.fileName = { contains: search };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── POST: Upload Document ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Datei zu groß. Maximale Dateigröße: 10 MB.",
        },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nicht unterstützter Dateityp. Erlaubt: Bilder (JPG, PNG, WebP, HEIC) und PDF.",
        },
        { status: 400 }
      );
    }

    // Validate document type
    const docType =
      type && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])
        ? type
        : "OTHER";

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to local storage
    const { storagePath, sha256Hash } = await saveDocument(
      buffer,
      file.name,
      session.user.organizationId
    );

    // Create document record
    const document = await prisma.document.create({
      data: {
        organizationId: session.user.organizationId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storagePath,
        sha256Hash,
        uploadedById: session.user.id,
        type: docType,
        ocrStatus: "PENDING",
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Audit entry
    try {
      await createAuditEntry({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "CREATE",
        entityType: "DOCUMENT",
        entityId: document.id,
        newState: {
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          type: document.type,
          sha256Hash: document.sha256Hash,
        },
      });
    } catch {
      // Audit-Fehler unterbricht den Hauptablauf nicht
    }

    return NextResponse.json(
      { success: true, data: document },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
