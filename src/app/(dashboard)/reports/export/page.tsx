import { ExportPanel } from "@/components/reports/export-panel";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Datenexport
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Buchungsdaten exportieren fuer Ihren Steuerberater oder zur Archivierung
        </p>
      </div>

      <ExportPanel />
    </div>
  );
}
