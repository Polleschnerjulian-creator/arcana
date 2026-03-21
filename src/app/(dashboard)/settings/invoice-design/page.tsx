import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InvoiceDesignPanel } from "@/components/settings/invoice-design-panel";

// ─── Types ──────────────────────────────────────────────────────

interface InvoiceSettings {
  logoUrl?: string;
  accentColor?: string;
  bankName?: string;
  bankIban?: string;
  bankBic?: string;
  paymentTermsDays?: number;
  paymentTermsText?: string;
  footerText?: string;
  showUstId?: boolean;
  showTaxId?: boolean;
}

// ─── Data Fetching ──────────────────────────────────────────────

async function getInvoiceDesignData(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      street: true,
      city: true,
      zip: true,
      ustId: true,
      taxId: true,
      settings: true,
    },
  });

  if (!org) return null;

  let invoiceSettings: InvoiceSettings = {};
  if (org.settings) {
    try {
      const parsed = JSON.parse(org.settings);
      invoiceSettings = parsed.invoice || {};
    } catch {
      // Corrupted JSON — start fresh
    }
  }

  return {
    organization: {
      name: org.name,
      street: org.street,
      city: org.city,
      zip: org.zip,
      ustId: org.ustId,
      taxId: org.taxId,
    },
    invoiceSettings,
  };
}

// ─── Page Component ─────────────────────────────────────────────

export default async function InvoiceDesignPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })
    ?.organizationId;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--color-text-secondary)]">
          Keine Organisation zugeordnet.
        </p>
      </div>
    );
  }

  const data = await getInvoiceDesignData(organizationId);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--color-text-secondary)]">
          Daten konnten nicht geladen werden.
        </p>
      </div>
    );
  }

  return (
    <InvoiceDesignPanel
      organization={data.organization}
      initialSettings={data.invoiceSettings}
    />
  );
}
