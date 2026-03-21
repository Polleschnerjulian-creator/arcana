import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify the account belongs to the user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Konto nicht gefunden." },
        { status: 404 }
      );
    }

    // System accounts cannot be modified
    if (account.isSystem) {
      return NextResponse.json(
        { success: false, error: "Systemkonten koennen nicht bearbeitet werden." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (typeof body.name === "string" && body.name.length >= 2) {
      updateData.name = body.name;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Keine gültigen Felder zum Aktualisieren." },
        { status: 400 }
      );
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedAccount });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
