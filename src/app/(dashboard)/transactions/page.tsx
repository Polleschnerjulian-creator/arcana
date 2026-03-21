import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { TransactionTable } from "@/components/transactions/transaction-table";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const transactions = await prisma.transaction.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      lines: {
        include: {
          account: { select: { id: true, number: true, name: true } },
          taxAccount: { select: { id: true, number: true, name: true } },
        },
      },
      bookedBy: { select: { id: true, name: true } },
      cancelledBy: {
        select: { id: true, description: true, reference: true },
      },
      stornoOf: {
        select: { id: true, description: true, reference: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Serialize Decimal fields for client component
  const serialized = transactions.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString(),
    description: tx.description,
    reference: tx.reference,
    status: tx.status as "DRAFT" | "BOOKED" | "CANCELLED",
    source: tx.source,
    aiConfidence: tx.aiConfidence,
    bookedAt: tx.bookedAt?.toISOString() || null,
    createdAt: tx.createdAt.toISOString(),
    bookedBy: tx.bookedBy,
    cancelledBy: tx.cancelledBy
      ? {
          id: tx.cancelledBy.id,
          description: tx.cancelledBy.description,
          reference: tx.cancelledBy.reference,
        }
      : null,
    stornoOf: tx.stornoOf
      ? {
          id: tx.stornoOf.id,
          description: tx.stornoOf.description,
          reference: tx.stornoOf.reference,
        }
      : null,
    lines: tx.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      debit: Number(line.debit),
      credit: Number(line.credit),
      taxRate: line.taxRate,
      note: line.note,
      account: line.account,
      taxAccount: line.taxAccount,
    })),
  }));

  // Summary stats
  const totalCount = serialized.length;
  const draftCount = serialized.filter((t) => t.status === "DRAFT").length;
  const bookedCount = serialized.filter((t) => t.status === "BOOKED").length;
  const cancelledCount = serialized.filter(
    (t) => t.status === "CANCELLED"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Buchungen
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {totalCount} gesamt &middot; {draftCount} Entwürfe &middot;{" "}
            {bookedCount} gebucht &middot; {cancelledCount} storniert
          </p>
        </div>
      </div>

      <TransactionTable transactions={serialized} />
    </div>
  );
}
