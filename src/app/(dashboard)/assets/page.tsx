import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AssetList } from "@/components/assets/asset-list";

export default async function AssetsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const assets = await prisma.fixedAsset.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });

  // Fetch ASSET-type accounts for the dropdown (Anlagekonten)
  const assetAccounts = await prisma.account.findMany({
    where: {
      organizationId: session.user.organizationId,
      type: "ASSET",
      category: "ANLAGE",
      isActive: true,
    },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true },
  });

  // Serialize
  const serializedAssets = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    description: asset.description,
    accountId: asset.accountId,
    purchaseDate: asset.purchaseDate.toISOString(),
    purchasePrice: Number(asset.purchasePrice),
    usefulLifeYears: asset.usefulLifeYears,
    depreciationMethod: asset.depreciationMethod,
    residualValue: Number(asset.residualValue),
    currentBookValue: Number(asset.currentBookValue),
    isActive: asset.isActive,
    disposalDate: asset.disposalDate?.toISOString() || null,
    disposalPrice: asset.disposalPrice ? Number(asset.disposalPrice) : null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }));

  const activeCount = serializedAssets.filter((a) => a.isActive).length;
  const totalBookValue = serializedAssets
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.currentBookValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Anlagen
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {activeCount} aktive Anlagen &middot; Buchwert gesamt:{" "}
            {new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
            }).format(totalBookValue)}
          </p>
        </div>
      </div>

      <AssetList assets={serializedAssets} accounts={assetAccounts} />
    </div>
  );
}
