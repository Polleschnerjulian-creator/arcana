import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calculator,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const reportTypes = [
  {
    title: "Einnahmenüberschussrechnung",
    shortTitle: "EÜR",
    description:
      "Gegenüberstellung von Betriebseinnahmen und Betriebsausgaben nach § 4 Abs. 3 EStG. Pflicht für Freiberufler und Kleinunternehmer.",
    href: "/reports/eur",
    icon: Calculator,
    badge: "Steuerlich relevant",
    badgeVariant: "success" as const,
  },
  {
    title: "Betriebswirtschaftliche Auswertung",
    shortTitle: "BWA",
    description:
      "Monatliche Erfolgsübersicht mit Umsatzerlösen, Kostenarten und Betriebsergebnis. Standard-Format für Banken und Steuerberater.",
    href: "/reports/bwa",
    icon: TrendingUp,
    badge: "Monatlich",
    badgeVariant: "info" as const,
  },
  {
    title: "Datenexport",
    shortTitle: "Export",
    description:
      "DATEV-Buchungsstapel und CSV-Export für Ihren Steuerberater. Kompatibel mit DATEV Unternehmen online und allen gaengigen Buchhaltungsprogrammen.",
    href: "/reports/export",
    icon: FileSpreadsheet,
    badge: "DATEV-kompatibel",
    badgeVariant: "default" as const,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Berichte</h1>
        <p className="text-sm text-text-secondary mt-1">
          Auswertungen, Berichte und Exporte fuer Ihre Buchhaltung
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.href}
              className="flex flex-col hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={report.badgeVariant}>{report.badge}</Badge>
                </div>
                <CardTitle className="mt-3 text-lg">{report.shortTitle}</CardTitle>
                <CardDescription className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {report.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {report.description}
                </p>
              </CardContent>
              <CardFooter>
                <Link href={report.href} className="w-full">
                  <Button variant="secondary" className="w-full group-hover:border-primary group-hover:text-primary transition-colors">
                    Erstellen
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
