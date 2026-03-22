import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TeamPanel } from "@/components/settings/team-panel";

// ─── Data Fetching ──────────────────────────────────────────────

async function getTeamData(organizationId: string) {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return users;
}

// ─── Page Component ─────────────────────────────────────────────

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  const organizationId = (session?.user as { organizationId?: string })
    ?.organizationId;
  const currentUserRole = (session?.user as { role?: string })?.role;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Keine Organisation zugeordnet.</p>
      </div>
    );
  }

  const users = await getTeamData(organizationId);

  return (
    <TeamPanel
      members={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      }))}
      currentUserRole={currentUserRole || "VIEWER"}
    />
  );
}
