import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AccountsTable } from "@/components/accounts/accounts-table";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

interface AccountGroup {
  type: AccountType;
  label: string;
  sublabel: string;
  accounts: Array<{
    id: string;
    number: string;
    name: string;
    type: string;
    category: string;
    isSystem: boolean;
    isActive: boolean;
  }>;
}

const TYPE_CONFIG: Record<
  AccountType,
  { label: string; sublabel: string; order: number }
> = {
  ASSET: { label: "Aktiva", sublabel: "Klasse 0-1", order: 0 },
  LIABILITY: { label: "Passiva", sublabel: "Klasse 3", order: 1 },
  EQUITY: { label: "Eigenkapital", sublabel: "Klasse 0", order: 2 },
  REVENUE: { label: "Erloese", sublabel: "Klasse 8", order: 3 },
  EXPENSE: { label: "Aufwand", sublabel: "Klasse 4-7", order: 4 },
};

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const accounts = await prisma.account.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { number: "asc" },
  });

  // Group accounts by type
  const groupMap = new Map<AccountType, AccountGroup>();

  for (const type of Object.keys(TYPE_CONFIG) as AccountType[]) {
    const config = TYPE_CONFIG[type];
    groupMap.set(type, {
      type,
      label: config.label,
      sublabel: config.sublabel,
      accounts: [],
    });
  }

  for (const account of accounts) {
    const group = groupMap.get(account.type as AccountType);
    if (group) {
      group.accounts.push({
        id: account.id,
        number: account.number,
        name: account.name,
        type: account.type,
        category: account.category,
        isSystem: account.isSystem,
        isActive: account.isActive,
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => TYPE_CONFIG[a.type].order - TYPE_CONFIG[b.type].order
  );

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Kontenplan
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {totalAccounts} Konten gesamt &middot; {activeAccounts} aktiv
          </p>
        </div>
      </div>

      <AccountsTable groups={groups} />
    </div>
  );
}
