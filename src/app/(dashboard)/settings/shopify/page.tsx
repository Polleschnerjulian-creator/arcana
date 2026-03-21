import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ShopifyPanel } from "@/components/settings/shopify-panel";

// ── Data Fetching ────────────────────────────────────────────────

async function getShopifyConnection(organizationId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/settings/shopify`,
      {
        headers: { "x-organization-id": organizationId },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.connection || null;
  } catch {
    // API route may not exist yet — return null
    return null;
  }
}

async function getShopifyOrders(organizationId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/settings/shopify/orders?limit=20`,
      {
        headers: { "x-organization-id": organizationId },
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders || [];
  } catch {
    // API route may not exist yet — return empty
    return [];
  }
}

// ── Page Component ──────────────────────────────────────────────

export default async function ShopifySettingsPage() {
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

  const [connection, orders] = await Promise.all([
    getShopifyConnection(organizationId),
    getShopifyOrders(organizationId),
  ]);

  return (
    <ShopifyPanel
      initialConnection={connection}
      initialOrders={orders}
    />
  );
}
