import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RecurringPanel } from "@/components/settings/recurring-panel";

// ─── Data Fetching ──────────────────────────────────────────────

async function getRecurringTemplates(organizationId: string) {
  const templates = await prisma.recurringTemplate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return templates.map((t) => ({
    id: t.id,
    type: t.type as "INVOICE" | "TRANSACTION",
    name: t.name,
    interval: t.interval as "MONTHLY" | "QUARTERLY" | "YEARLY",
    dayOfMonth: t.dayOfMonth,
    nextRunDate: t.nextRunDate.toISOString(),
    lastRunDate: t.lastRunDate?.toISOString() ?? null,
    isActive: t.isActive,
    templateData: JSON.parse(t.templateData),
    createdAt: t.createdAt.toISOString(),
  }));
}

// ─── Page Component ─────────────────────────────────────────────

export default async function RecurringPage() {
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

  const templates = await getRecurringTemplates(organizationId);

  return <RecurringPanel initialTemplates={templates} />;
}
