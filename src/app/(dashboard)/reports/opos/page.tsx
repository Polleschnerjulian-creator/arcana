import { OPOSReport } from "@/components/reports/opos-report";

export default function OPOSPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Offene Posten
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Übersicht aller offenen und überfälligen Ausgangsrechnungen
        </p>
      </div>

      <OPOSReport />
    </div>
  );
}
