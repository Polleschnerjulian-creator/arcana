import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const stats = [
  {
    title: "Einnahmen",
    value: formatCurrency(48250.0),
    subtitle: "Laufender Monat",
    trend: "+12.5%",
    trendUp: true,
  },
  {
    title: "Ausgaben",
    value: formatCurrency(31480.0),
    subtitle: "Laufender Monat",
    trend: "+3.2%",
    trendUp: false,
  },
  {
    title: "Offene Belege",
    value: "14",
    subtitle: "Warten auf Zuordnung",
    trend: null,
    trendUp: false,
  },
  {
    title: "Offene Posten",
    value: formatCurrency(8920.0),
    subtitle: "3 Rechnungen",
    trend: null,
    trendUp: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Finanzuebersicht und aktuelle Kennzahlen
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-text-primary amount">
                {stat.value}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-muted">{stat.subtitle}</span>
                {stat.trend && (
                  <span
                    className={`text-xs font-medium ${
                      stat.trendUp ? "text-success" : "text-danger"
                    }`}
                  >
                    {stat.trend}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
