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
  ListChecks,
  BookOpen,
  Wallet,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Report Definitions ──────────────────────────────────────────

interface ReportCard {
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  icon: typeof Calculator;
  badge: string;
  badgeVariant: "default" | "success" | "warning" | "danger" | "info";
}

const pflichtberichte: ReportCard[] = [
  {
    title: "Einnahmenüberschussrechnung",
    shortTitle: "EÜR",
    description:
      "Gegenüberstellung von Betriebseinnahmen und Betriebsausgaben nach § 4 Abs. 3 EStG. Pflicht für Freiberufler und Kleinunternehmer.",
    href: "/reports/eur",
    icon: Calculator,
    badge: "Steuerlich relevant",
    badgeVariant: "success",
  },
  {
    title: "Betriebswirtschaftliche Auswertung",
    shortTitle: "BWA",
    description:
      "Monatliche Erfolgsübersicht mit Umsatzerlösen, Kostenarten und Betriebsergebnis. Standard-Format für Banken und Steuerberater.",
    href: "/reports/bwa",
    icon: TrendingUp,
    badge: "Monatlich",
    badgeVariant: "info",
  },
  {
    title: "Summen- und Saldenliste",
    shortTitle: "Saldenliste",
    description:
      "Uebersicht aller Konten mit Soll-, Haben- und Saldobetraegen. Prueft die Ausgeglichenheit der doppelten Buchfuehrung.",
    href: "/reports/saldenliste",
    icon: ListChecks,
    badge: "Periodenabschluss",
    badgeVariant: "success",
  },
];

const kontenansicht: ReportCard[] = [
  {
    title: "Kontoblatt",
    shortTitle: "Kontoblatt",
    description:
      "Detaillierte Kontobewegungen mit laufendem Saldo. Einzelne Konten mit Anfangs- und Endbestand analysieren.",
    href: "/reports/kontoblatt",
    icon: BookOpen,
    badge: "Einzelkonto",
    badgeVariant: "default",
  },
  {
    title: "Kassenbuch",
    shortTitle: "Kassenbuch",
    description:
      "Gesetzlich vorgeschriebene Aufzeichnung aller Bargeldbewegungen. Tägliche Dokumentation mit Anfangs- und Endbestand.",
    href: "/reports/kassenbuch",
    icon: Wallet,
    badge: "Gesetzlich",
    badgeVariant: "warning",
  },
  {
    title: "Offene Posten",
    shortTitle: "Offene Posten",
    description:
      "Liste aller offenen und überfälligen Ausgangsrechnungen, gruppiert nach Kunden. Für das Forderungsmanagement und Mahnwesen.",
    href: "/reports/opos",
    icon: Clock,
    badge: "Debitoren",
    badgeVariant: "info",
  },
];

const exportSection: ReportCard[] = [
  {
    title: "Datenexport",
    shortTitle: "Export",
    description:
      "DATEV-Buchungsstapel und CSV-Export für Ihren Steuerberater. Kompatibel mit DATEV Unternehmen online und allen gaengigen Buchhaltungsprogrammen.",
    href: "/reports/export",
    icon: FileSpreadsheet,
    badge: "DATEV-kompatibel",
    badgeVariant: "default",
  },
];

// ─── Section Component ───────────────────────────────────────────

function ReportSection({
  heading,
  reports,
}: {
  heading: string;
  reports: ReportCard[];
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.href}
              className="flex flex-col hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-primary group-hover:bg-primary group-hover:text-white transition-colors">
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

// ─── Page ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Berichte</h1>
        <p className="text-sm text-text-secondary mt-1">
          Auswertungen, Berichte und Exporte fuer Ihre Buchhaltung
        </p>
      </div>

      {/* Report Sections */}
      <ReportSection heading="Pflichtberichte" reports={pflichtberichte} />
      <ReportSection heading="Kontenansicht" reports={kontenansicht} />
      <ReportSection heading="Export" reports={exportSection} />
    </div>
  );
}
