import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── DELETE: Remove a custom template ────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    // Prevent deleting default templates
    if (id.startsWith("default-")) {
      return NextResponse.json(
        { success: false, error: "Standardvorlagen können nicht gelöscht werden." },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const template = await prisma.bookingTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Vorlage nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.bookingTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
