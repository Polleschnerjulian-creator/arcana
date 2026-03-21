import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { put, del } from "@vercel/blob";

// ─── Constants ──────────────────────────────────────────────────

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

// ─── POST: Upload logo ─────────────────────────────────────────

export async function POST(request: Request) {
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

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ungueltiges Dateiformat. Erlaubt: JPG, PNG, WebP, SVG.",
        },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Datei zu gross. Maximale Groesse: 2 MB.",
        },
        { status: 400 }
      );
    }

    const orgId = session.user.organizationId;

    // Determine file extension
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = extMap[file.type] || "png";
    const pathname = `logos/${orgId}/logo-${Date.now()}.${ext}`;

    // Upload to Vercel Blob
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Blob-Speicher nicht konfiguriert." },
        { status: 503 }
      );
    }

    const blob = await put(pathname, file, {
      access: "private",
      contentType: file.type,
      token,
    });

    // Get existing settings to check for old logo
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    let settings: Record<string, unknown> = {};
    if (org?.settings) {
      try {
        settings = JSON.parse(org.settings);
      } catch {
        // Corrupted JSON — start fresh
      }
    }

    const existingInvoice =
      (settings.invoice as Record<string, unknown>) || {};
    const oldLogoUrl = existingInvoice.logoUrl as string | undefined;

    // Delete old logo from Blob if exists
    if (oldLogoUrl) {
      try {
        await del(oldLogoUrl);
      } catch {
        // Old logo may already be deleted — ignore
      }
    }

    // Save new logo URL in settings
    settings.invoice = { ...existingInvoice, logoUrl: blob.url };

    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json({
      success: true,
      data: { logoUrl: blob.url },
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove logo ────────────────────────────────────────

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const orgId = session.user.organizationId;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    let settings: Record<string, unknown> = {};
    if (org?.settings) {
      try {
        settings = JSON.parse(org.settings);
      } catch {
        // Corrupted JSON — start fresh
      }
    }

    const existingInvoice =
      (settings.invoice as Record<string, unknown>) || {};
    const logoUrl = existingInvoice.logoUrl as string | undefined;

    if (!logoUrl) {
      return NextResponse.json(
        { success: false, error: "Kein Logo vorhanden." },
        { status: 404 }
      );
    }

    // Delete from Blob
    try {
      await del(logoUrl);
    } catch {
      // May already be deleted — continue
    }

    // Remove from settings
    delete existingInvoice.logoUrl;
    settings.invoice = existingInvoice;

    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
