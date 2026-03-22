import { KassenbuchReport } from "@/components/reports/kassenbuch-report";

export default function KassenbuchPage() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = now.toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Kassenbuch
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Aufzeichnung aller Bargeldbewegungen nach gesetzlichen Vorgaben
        </p>
      </div>

      <KassenbuchReport defaultFrom={defaultFrom} defaultTo={defaultTo} />
    </div>
  );
}
