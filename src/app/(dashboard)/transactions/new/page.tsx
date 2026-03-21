import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { BookingForm } from "@/components/transactions/booking-form";

export default async function NewTransactionPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const accounts = await prisma.account.findMany({
    where: {
      organizationId: session.user.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      number: true,
      name: true,
      type: true,
    },
    orderBy: { number: "asc" },
  });

  // Serialize for client component
  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    number: a.number,
    name: a.name,
    type: a.type,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Neue Buchung
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Erstellen Sie einen neuen Buchungssatz
        </p>
      </div>

      <BookingForm accounts={serializedAccounts} />
    </div>
  );
}
