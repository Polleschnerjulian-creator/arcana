import { SaldenlisteReport } from "@/components/reports/saldenliste-report";

export default function SaldenlistePage() {
  // Default: current fiscal year (Jan 1 to Dec 31)
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = `${now.getFullYear()}-12-31`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Summen- und Saldenliste
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Uebersicht aller Konten mit Soll-, Haben- und Saldobetraegen
        </p>
      </div>

      <SaldenlisteReport defaultFrom={defaultFrom} defaultTo={defaultTo} />
    </div>
  );
}
