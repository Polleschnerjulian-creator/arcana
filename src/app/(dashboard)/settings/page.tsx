import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/settings-form";

// ─── Data Fetching ──────────────────────────────────────────────

async function getSettingsData(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  // Check if any BOOKED transactions exist (locks chartOfAccounts)
  const hasBookedTransactions =
    (await prisma.transaction.count({
      where: {
        organizationId,
        status: "BOOKED",
      },
    })) > 0;

  return { organization, hasBookedTransactions };
}

// ─── Page Component ─────────────────────────────────────────────

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })
    ?.organizationId;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
      </div>
    );
  }

  const { organization, hasBookedTransactions } =
    await getSettingsData(organizationId);

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Daten konnten nicht geladen werden.</p>
      </div>
    );
  }

  return (
    <SettingsForm
      organization={{
        id: organization.id,
        name: organization.name,
        legalForm: organization.legalForm,
        taxId: organization.taxId,
        ustId: organization.ustId,
        street: organization.street,
        city: organization.city,
        zip: organization.zip,
        chartOfAccounts: organization.chartOfAccounts,
        accountingMethod: organization.accountingMethod,
        fiscalYearStart: organization.fiscalYearStart,
      }}
      hasBookedTransactions={hasBookedTransactions}
    />
  );
}
