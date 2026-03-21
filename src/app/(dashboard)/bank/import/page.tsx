import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImportForm } from "@/components/bank/import-form";
import { ArrowLeft } from "lucide-react";

export default async function BankImportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      account: { select: { id: true, number: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const serializedAccounts = bankAccounts.map((ba) => ({
    id: ba.id,
    name: ba.name,
    iban: ba.iban,
    account: ba.account,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/bank">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Umsätze importieren
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            CSV- oder MT940-Datei hochladen und Bankumsätze importieren
          </p>
        </div>
      </div>

      <ImportForm bankAccounts={serializedAccounts} />
    </div>
  );
}
