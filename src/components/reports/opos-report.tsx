"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Loader2,
  AlertCircle,
  Printer,
  FileText,
  Clock,
  AlertTriangle,
  Building2,
} from "lucide-react";

// ─── Debitoren Types ────────────────────────────────────────────

interface OPOSInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
  daysOverdue: number;
}

interface OPOSCustomerGroup {
  customerName: string;
  invoices: OPOSInvoice[];
  subtotal: number;
  overdueSubtotal: number;
  invoiceCount: number;
}

interface OPOSData {
  asOf: string;
  customers: OPOSCustomerGroup[];
  totalInvoices: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
}

// ─── Kreditoren Types ───────────────────────────────────────────

interface KreditorenItem {
  transactionId: string;
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  vendorName: string;
}

interface KreditorenVendorGroup {
  vendorName: string;
  items: KreditorenItem[];
  subtotal: number;
  itemCount: number;
}

interface KreditorenData {
  asOf: string;
  vendors: KreditorenVendorGroup[];
  totalItems: number;
  totalOutstanding: number;
}

type ReportTab = "debitoren" | "kreditoren";

// ─── Component ───────────────────────────────────────────────────

export function OPOSReport() {
  const [activeTab, setActiveTab] = useState<ReportTab>("debitoren");
  const [debitorenData, setDebitorenData] = useState<OPOSData | null>(null);
  const [kreditorenData, setKreditorenData] = useState<KreditorenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (tab: ReportTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/opos?type=${tab}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Bericht konnte nicht geladen werden.");
      }
      const json = await res.json();
      if (tab === "kreditoren") {
        setKreditorenData(json.data);
      } else {
        setDebitorenData(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, fetchReport]);

  function handlePrint() {
    window.print();
  }

  function handleTabChange(tab: ReportTab) {
    setActiveTab(tab);
  }

  const data = activeTab === "debitoren" ? debitorenData : kreditorenData;

  return (
    <div className="space-y-6">
      {/* Tab Toggle + Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Tab buttons */}
            <div className="flex gap-1 rounded-lg border border-[var(--glass-border)] p-1 bg-black/[0.02] dark:bg-white/[0.02]">
              <button
                onClick={() => handleTabChange("debitoren")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all",
                  activeTab === "debitoren"
                    ? "bg-[var(--glass-bg)] text-[var(--color-text)] shadow-sm border border-[var(--glass-border)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                )}
              >
                Debitoren
              </button>
              <button
                onClick={() => handleTabChange("kreditoren")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all",
                  activeTab === "kreditoren"
                    ? "bg-[var(--glass-bg)] text-[var(--color-text)] shadow-sm border border-[var(--glass-border)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                )}
              >
                Kreditoren
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <p className="text-sm text-[var(--color-text-secondary)] mr-2">
                {data ? `Stand: ${formatDate((data as OPOSData | KreditorenData).asOf)}` : "Wird geladen..."}
              </p>
              <Button variant="secondary" size="sm" onClick={() => fetchReport(activeTab)} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laden...
                  </>
                ) : (
                  "Aktualisieren"
                )}
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Drucken
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-[var(--color-danger)]">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* Debitoren View */}
      {activeTab === "debitoren" && !loading && debitorenData && (
        <DebitorenView data={debitorenData} />
      )}

      {/* Kreditoren View */}
      {activeTab === "kreditoren" && !loading && kreditorenData && (
        <KreditorenView data={kreditorenData} />
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #opos-report,
          #opos-report * {
            visibility: visible;
          }
          #opos-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Debitoren View ──────────────────────────────────────────────

function DebitorenView({ data }: { data: OPOSData }) {
  if (data.customers.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-[var(--color-text-tertiary)]" />
            <p className="text-lg font-medium text-[var(--color-text)]">
              Keine offenen Debitoren-Posten
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Alle Ausgangsrechnungen wurden bezahlt.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Offene Rechnungen
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text)]">
                {data.totalInvoices}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Ausstehend gesamt
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(data.totalOutstanding)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Davon überfällig
                </p>
                {data.overdueCount > 0 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                )}
              </div>
              <p className={`text-2xl font-bold font-mono tabular-nums ${
                data.totalOverdue > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
              }`}>
                {formatCurrency(data.totalOverdue)}
              </p>
              {data.overdueCount > 0 && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {data.overdueCount} {data.overdueCount === 1 ? "Rechnung" : "Rechnungen"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="opos-report">
        <Card className="print:border-0 print:shadow-none overflow-hidden">
          <CardHeader className="border-b border-[var(--glass-border)] text-center">
            <CardTitle className="text-xl">
              Offene Posten Liste — Debitoren
            </CardTitle>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Stand: {formatDate(data.asOf)}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-[var(--glass-border)]">
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Rechnung-Nr
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Rechnungsdatum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Fällig am
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-36">
                      Betrag
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-32">
                      Tage überfällig
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((customer) => (
                    <CustomerGroup key={customer.customerName} customer={customer} />
                  ))}

                  {/* Grand Total */}
                  <tr className="border-t-2 border-[var(--glass-border)] bg-black/[0.03] dark:bg-white/[0.03]">
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-[var(--color-text)]">
                      Gesamt ({data.totalInvoices} {data.totalInvoices === 1 ? "Rechnung" : "Rechnungen"})
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-[var(--color-text)]">
                      {formatCurrency(data.totalOutstanding)}
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Kreditoren View ─────────────────────────────────────────────

function KreditorenView({ data }: { data: KreditorenData }) {
  if (data.vendors.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center space-y-3">
            <Building2 className="h-12 w-12 mx-auto text-[var(--color-text-tertiary)]" />
            <p className="text-lg font-medium text-[var(--color-text)]">
              Keine offenen Kreditoren-Posten
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Alle Verbindlichkeiten sind beglichen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Offene Verbindlichkeiten
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text)]">
                {data.totalItems}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Ausstehend gesamt
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(data.totalOutstanding)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="opos-report">
        <Card className="print:border-0 print:shadow-none overflow-hidden">
          <CardHeader className="border-b border-[var(--glass-border)] text-center">
            <CardTitle className="text-xl">
              Offene Posten Liste — Kreditoren
            </CardTitle>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Stand: {formatDate(data.asOf)}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-[var(--glass-border)]">
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Lieferant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Buchungstext
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Belegnummer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Buchungsdatum
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider w-36">
                      Betrag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendors.map((vendor) => (
                    <VendorGroup key={vendor.vendorName} vendor={vendor} />
                  ))}

                  {/* Grand Total */}
                  <tr className="border-t-2 border-[var(--glass-border)] bg-black/[0.03] dark:bg-white/[0.03]">
                    <td colSpan={4} className="px-6 py-4 text-sm font-bold text-[var(--color-text)]">
                      Gesamt ({data.totalItems} {data.totalItems === 1 ? "Position" : "Positionen"})
                    </td>
                    <td className="px-6 py-4 text-sm font-bold font-mono tabular-nums text-right text-[var(--color-text)]">
                      {formatCurrency(data.totalOutstanding)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function CustomerGroup({ customer }: { customer: OPOSCustomerGroup }) {
  return (
    <>
      {/* Customer Header */}
      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-t border-[var(--glass-border)]">
        <td colSpan={5} className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {customer.customerName}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                ({customer.invoiceCount} {customer.invoiceCount === 1 ? "Rechnung" : "Rechnungen"})
              </span>
            </div>
            <span className="text-sm font-semibold font-mono tabular-nums text-[var(--color-text)]">
              {formatCurrency(customer.subtotal)}
            </span>
          </div>
        </td>
      </tr>

      {/* Invoice Rows */}
      {customer.invoices.map((inv) => (
        <tr
          key={inv.id}
          className="border-b border-[var(--glass-border)]/50 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
        >
          <td className="px-6 py-3 text-sm font-mono text-[var(--color-text)]">
            {inv.invoiceNumber}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">
            {formatDate(inv.issueDate)}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">
            {formatDate(inv.dueDate)}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-[var(--color-text)]">
            {formatCurrency(inv.total)}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right">
            {inv.daysOverdue > 0 ? (
              <span className={`${
                inv.daysOverdue > 30
                  ? "text-[var(--color-danger)] font-bold"
                  : "text-[var(--color-danger)]"
              }`}>
                {inv.daysOverdue}
              </span>
            ) : (
              <span className="text-[var(--color-text-tertiary)]">—</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function VendorGroup({ vendor }: { vendor: KreditorenVendorGroup }) {
  return (
    <>
      {/* Vendor Header */}
      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-t border-[var(--glass-border)]">
        <td colSpan={5} className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {vendor.vendorName}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                ({vendor.itemCount} {vendor.itemCount === 1 ? "Position" : "Positionen"})
              </span>
            </div>
            <span className="text-sm font-semibold font-mono tabular-nums text-[var(--color-text)]">
              {formatCurrency(vendor.subtotal)}
            </span>
          </div>
        </td>
      </tr>

      {/* Item Rows */}
      {vendor.items.map((item) => (
        <tr
          key={item.transactionId}
          className="border-b border-[var(--glass-border)]/50 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
        >
          <td className="px-6 py-3 text-sm text-[var(--color-text)]">
            {item.vendorName}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)] max-w-[200px] truncate">
            {item.description}
          </td>
          <td className="px-6 py-3 text-sm font-mono text-[var(--color-text-secondary)]">
            {item.reference || "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">
            {formatDate(item.date)}
          </td>
          <td className="px-6 py-3 text-sm font-mono tabular-nums text-right text-[var(--color-text)]">
            {formatCurrency(item.amount)}
          </td>
        </tr>
      ))}
    </>
  );
}
