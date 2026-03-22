import { KontoblattReport } from "@/components/reports/kontoblatt-report";

export default function KontoblattPage() {
  // Default: current fiscal year (Jan 1 to Dec 31)
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = `${now.getFullYear()}-12-31`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Kontoblatt
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Detaillierte Kontobewegungen mit laufendem Saldo
        </p>
      </div>

      <KontoblattReport defaultFrom={defaultFrom} defaultTo={defaultTo} />
    </div>
  );
}
