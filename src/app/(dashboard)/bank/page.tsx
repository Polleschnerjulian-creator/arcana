import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { BankOverview } from "@/components/bank/bank-overview";
import { ReconciliationSummary } from "@/components/bank/reconciliation-summary";
import { AddBankAccountButton } from "@/components/bank/add-bank-account-button";
import { Building2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";

export default async function BankPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const orgId = session.user.organizationId;

  // Fetch available accounts for linking (bank/cash accounts)
  const availableAccounts = await prisma.account.findMany({
    where: { organizationId: orgId, isActive: true, type: "ASSET", category: "UMLAUF" },
    select: { id: true, number: true, name: true },
    orderBy: { number: "asc" },
  });

  // Fetch bank accounts with transaction counts and linked account info
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: orgId },
    include: {
      account: { select: { id: true, number: true, name: true } },
      bankTransactions: {
        orderBy: { date: "desc" },
        include: {
          matchedTransaction: {
            select: { id: true, description: true, reference: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Serialize data for client component
  const serializedAccounts = bankAccounts.map((ba) => ({
    id: ba.id,
    name: ba.name,
    iban: ba.iban,
    bic: ba.bic,
    lastImportAt: ba.lastImportAt?.toISOString() || null,
    account: ba.account,
    transactions: ba.bankTransactions.map((bt) => ({
      id: bt.id,
      date: bt.date.toISOString(),
      amount: Number(bt.amount),
      description: bt.description,
      counterpartName: bt.counterpartName,
      counterpartIban: bt.counterpartIban,
      matchStatus: bt.matchStatus as
        | "UNMATCHED"
        | "AI_SUGGESTED"
        | "CONFIRMED"
        | "MANUAL",
      matchConfidence: bt.matchConfidence,
      matchedTransactionId: bt.matchedTransactionId,
      matchedTransaction: bt.matchedTransaction
        ? {
            id: bt.matchedTransaction.id,
            description: bt.matchedTransaction.description,
            reference: bt.matchedTransaction.reference,
          }
        : null,
    })),
  }));

  // Compute overview stats
  const totalBankAccounts = bankAccounts.length;
  const allTransactions = bankAccounts.flatMap((ba) => ba.bankTransactions);
  const totalImported = allTransactions.length;
  const unmatchedCount = allTransactions.filter(
    (t) => t.matchStatus === "UNMATCHED"
  ).length;
  const aiSuggestedCount = allTransactions.filter(
    (t) => t.matchStatus === "AI_SUGGESTED"
  ).length;
  const confirmedCount = allTransactions.filter(
    (t) => t.matchStatus === "CONFIRMED"
  ).length;
  const manualCount = allTransactions.filter(
    (t) => t.matchStatus === "MANUAL"
  ).length;

  const lastImportDates = bankAccounts
    .map((ba) => ba.lastImportAt)
    .filter(Boolean) as Date[];
  const lastImportDate =
    lastImportDates.length > 0
      ? formatDate(
          lastImportDates.reduce((a, b) => (a > b ? a : b))
        )
      : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Bankkonten
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {totalBankAccounts} Konten &middot; {unmatchedCount} offene
            Zuordnungen &middot; Letzter Import: {lastImportDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/bank/import">
            <Button variant="secondary">
              <Upload className="h-4 w-4" />
              Umsätze importieren
            </Button>
          </Link>
          <AddBankAccountButton accounts={availableAccounts} />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Bankkonten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary">
              {totalBankAccounts}
            </div>
            <p className="text-xs text-text-muted mt-1">Verknüpfte Konten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Importierte Umsätze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-text-primary">
              {totalImported}
            </div>
            <p className="text-xs text-text-muted mt-1">Insgesamt</p>
          </CardContent>
        </Card>

        <Card className={unmatchedCount > 0 ? "border-danger/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
              {unmatchedCount > 0 && (
                <AlertCircle className="h-3.5 w-3.5 text-danger" />
              )}
              Nicht zugeordnet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${unmatchedCount > 0 ? "text-danger" : "text-text-primary"}`}
            >
              {unmatchedCount}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {aiSuggestedCount > 0
                ? `${aiSuggestedCount} KI-Vorschläge verfügbar`
                : "Alle zugeordnet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Zugeordnet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-success">
              {confirmedCount + manualCount}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {confirmedCount} bestätigt &middot; {manualCount} manuell
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Summary */}
      <ReconciliationSummary
        total={totalImported}
        confirmed={confirmedCount}
        manual={manualCount}
        aiSuggested={aiSuggestedCount}
        unmatched={unmatchedCount}
      />

      {/* Bank Accounts List */}
      {serializedAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-10 w-10 text-text-muted mb-3" />
            <p className="text-sm font-medium text-text-secondary">
              Noch keine Bankkonten verknüpft
            </p>
            <p className="text-xs text-text-muted mt-1 mb-4">
              Verknüpfen Sie ein Bankkonto, um Umsätze zu importieren.
            </p>
            <AddBankAccountButton accounts={availableAccounts} />
          </CardContent>
        </Card>
      ) : (
        <BankOverview accounts={serializedAccounts} />
      )}
    </div>
  );
}
