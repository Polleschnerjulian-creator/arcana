import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/settings-form";

// ─── Data Fetching ──────────────────────────────────────────────

async function getSettingsData(organizationId: string, userId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  // Check if any BOOKED transactions exist (locks chartOfAccounts)
  const hasBookedTransactions =
    (await prisma.transaction.count({
      where: {
        organizationId,
        status: "BOOKED",
      },
    })) > 0;

  return { organization, user, hasBookedTransactions };
}

// ─── Page Component ─────────────────────────────────────────────

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })
    ?.organizationId;
  const userId = (session?.user as { id?: string })?.id;

  if (!organizationId || !userId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
      </div>
    );
  }

  const { organization, user, hasBookedTransactions } =
    await getSettingsData(organizationId, userId);

  if (!organization || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Daten konnten nicht geladen werden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Einstellungen
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Unternehmens-, Buchhaltungs- und Benutzereinstellungen verwalten
        </p>
      </div>

      {/* Settings Form */}
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
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        }}
        hasBookedTransactions={hasBookedTransactions}
      />
    </div>
  );
}
