import { EURReport } from "@/components/reports/eur-report";

export default function EURPage() {
  // Default: current fiscal year (Jan 1 to Dec 31)
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = `${now.getFullYear()}-12-31`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Einnahmenüberschussrechnung
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Gegenüberstellung von Betriebseinnahmen und -ausgaben nach § 4 Abs. 3 EStG
        </p>
      </div>

      <EURReport defaultFrom={defaultFrom} defaultTo={defaultTo} />
    </div>
  );
}
