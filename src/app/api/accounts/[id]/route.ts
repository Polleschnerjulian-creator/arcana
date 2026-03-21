import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateAccountSchema = z.object({
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein.").max(120, "Name darf maximal 120 Zeichen lang sein.").optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
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

    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validierungsfehler.",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const updateData = parsed.data;

    if (
      updateData.name === undefined &&
      updateData.isActive === undefined
    ) {
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
