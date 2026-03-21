import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";

// ── Data Fetching ────────────────────────────────────────────────

async function getApiKeys(organizationId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/settings/api-keys`,
      {
        headers: { "x-organization-id": organizationId },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.apiKeys || [];
  } catch {
    // API route may not exist yet — return empty
    return [];
  }
}

async function getWebhookLogs(organizationId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/v1/webhook/logs?limit=10`,
      {
        headers: { "x-organization-id": organizationId },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  } catch {
    // API route may not exist yet — return empty
    return [];
  }
}

// ── Page Component ──────────────────────────────────────────────

export default async function IntegrationsPage() {
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

  const [apiKeys, webhookLogs] = await Promise.all([
    getApiKeys(organizationId),
    getWebhookLogs(organizationId),
  ]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Integrationen
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          API-Schluessel, Webhooks und externe Anbindungen verwalten
        </p>
      </div>

      {/* Integrations Panel */}
      <IntegrationsPanel
        initialApiKeys={apiKeys}
        initialWebhookLogs={webhookLogs}
      />
    </div>
  );
}
