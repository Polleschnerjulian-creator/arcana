import { BWAReport } from "@/components/reports/bwa-report";

export default function BWAPage() {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Betriebswirtschaftliche Auswertung
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Monatliche Erfolgsrechnung mit kumulierten Jahreswerten
        </p>
      </div>

      <BWAReport defaultYear={defaultYear} defaultMonth={defaultMonth} />
    </div>
  );
}
