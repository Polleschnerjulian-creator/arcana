"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

type ExportStatus = "idle" | "loading" | "success" | "error";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  filePrefix: string;
  fileExtension: string;
  icon: typeof FileSpreadsheet;
  badge: string;
  badgeVariant: "default" | "success" | "info";
}

// ─── Export Options ──────────────────────────────────────────────

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "datev",
    title: "DATEV Buchungsstapel",
    description:
      "Standard-Format fuer Ihren Steuerberater. Kompatibel mit DATEV Unternehmen online, DATEV Kanzlei-Rechnungswesen und allen DATEV-Produkten.",
    endpoint: "/api/export/datev",
    filePrefix: "datev_buchungsstapel",
    fileExtension: "csv",
    icon: FileSpreadsheet,
    badge: "CSV",
    badgeVariant: "default",
  },
  {
    id: "csv",
    title: "Buchungsjournal",
    description:
      "Alle Buchungen im universellen CSV-Format. Kompatibel mit Excel, Numbers, Google Sheets und allen gaengigen Tabellenkalkulationsprogrammen.",
    endpoint: "/api/export/csv",
    filePrefix: "buchungsjournal",
    fileExtension: "csv",
    icon: FileText,
    badge: "CSV",
    badgeVariant: "info",
  },
];

// ─── Component ───────────────────────────────────────────────────

export function ExportPanel() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = now.toISOString().split("T")[0];

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [statuses, setStatuses] = useState<Record<string, ExportStatus>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  async function handleExport(option: ExportOption) {
    setStatuses((prev) => ({ ...prev, [option.id]: "loading" }));
    setErrorMessages((prev) => ({ ...prev, [option.id]: "" }));

    try {
      const res = await fetch(`${option.endpoint}?from=${from}&to=${to}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export fehlgeschlagen.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${option.filePrefix}_${from}_${to}.${option.fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatuses((prev) => ({ ...prev, [option.id]: "success" }));

      // Reset success status after 3 seconds
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [option.id]: "idle" }));
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.";
      setStatuses((prev) => ({ ...prev, [option.id]: "error" }));
      setErrorMessages((prev) => ({ ...prev, [option.id]: message }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportzeitraum</CardTitle>
          <CardDescription>
            Waehlen Sie den Zeitraum fuer den Datenexport
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <Input
              type="date"
              label="Von"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-48"
            />
            <Input
              type="date"
              label="Bis"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {EXPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const status = statuses[option.id] || "idle";
          const errorMsg = errorMessages[option.id] || "";

          return (
            <Card
              key={option.id}
              className={`flex flex-col transition-all ${
                status === "success"
                  ? "border-success/50"
                  : status === "error"
                    ? "border-danger/50"
                    : "hover:border-primary/30 hover:shadow-md"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={option.badgeVariant}>{option.badge}</Badge>
                </div>
                <CardTitle className="mt-3 text-base">{option.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {option.description}
                </p>

                {/* Status Messages */}
                {status === "success" && (
                  <div className="flex items-center gap-2 mt-3 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Download gestartet</span>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-center gap-2 mt-3 text-danger">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{errorMsg}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleExport(option)}
                  disabled={status === "loading"}
                  className="w-full"
                  variant={status === "success" ? "secondary" : "primary"}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Exportiert...
                    </>
                  ) : status === "success" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Heruntergeladen
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Herunterladen
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
