"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Pencil,
  Send,
  Trash2,
  CheckCircle2,
  Printer,
  XCircle,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerAddress: string | null;
  issueDate: string;
  dueDate: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  lineItems: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  transactionId: string | null;
  createdAt: string;
}

type StatusFilter = "ALL" | "DRAFT" | "SENT" | "PAID" | "CANCELLED";

interface InvoiceListProps {
  invoices: InvoiceData[];
}

// ─── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InvoiceData["status"],
  { label: string; variant: "default" | "info" | "success" | "danger" | "warning" }
> = {
  DRAFT: { label: "Entwurf", variant: "default" },
  SENT: { label: "Versendet", variant: "info" },
  PAID: { label: "Bezahlt", variant: "success" },
  OVERDUE: { label: "Überfällig", variant: "danger" },
  CANCELLED: { label: "Storniert", variant: "danger" },
};

// ─── Component ──────────────────────────────────────────────────

export function InvoiceList({ invoices }: InvoiceListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter invoices
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (statusFilter !== "ALL" && inv.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCustomer = inv.customerName.toLowerCase().includes(q);
        const matchesNumber = inv.invoiceNumber.toLowerCase().includes(q);
        if (!matchesCustomer && !matchesNumber) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "Alle", count: invoices.length },
    {
      key: "DRAFT",
      label: "Entwürfe",
      count: invoices.filter((i) => i.status === "DRAFT").length,
    },
    {
      key: "SENT",
      label: "Versendet",
      count: invoices.filter(
        (i) => i.status === "SENT" || i.status === "OVERDUE"
      ).length,
    },
    {
      key: "PAID",
      label: "Bezahlt",
      count: invoices.filter((i) => i.status === "PAID").length,
    },
    {
      key: "CANCELLED",
      label: "Storniert",
      count: invoices.filter((i) => i.status === "CANCELLED").length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Kunde oder Rechnungsnr. suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] transition-all duration-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-[var(--glass-border)]">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              statusFilter === tab.key
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 text-xs",
                statusFilter === tab.key
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-tertiary)]"
              )}
            >
              {tab.count}
            </span>
            {statusFilter === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-text)] rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden shadow">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
            <FileText className="h-10 w-10 mb-3 text-[var(--color-text-tertiary)]" />
            <p className="text-sm font-medium">
              {invoices.length === 0
                ? "Noch keine Rechnungen erstellt"
                : "Keine Rechnungen gefunden"}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              {invoices.length === 0
                ? "Erstellen Sie Ihre erste Rechnung."
                : "Versuchen Sie andere Filterkriterien."}
            </p>
            {invoices.length === 0 && (
              <Link href="/invoices/new" className="mt-4">
                <Button size="sm" variant="secondary">
                  <Plus className="h-3.5 w-3.5" />
                  Rechnung erstellen
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Rechnungsnr.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Kunde
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Fällig am
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Betrag
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {filtered.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      isExpanded={expandedId === inv.id}
                      onToggle={() =>
                        setExpandedId(expandedId === inv.id ? null : inv.id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-[var(--glass-border)]">
              {filtered.map((inv) => (
                <InvoiceMobileCard
                  key={inv.id}
                  invoice={inv}
                  isExpanded={expandedId === inv.id}
                  onToggle={() =>
                    setExpandedId(expandedId === inv.id ? null : inv.id)
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <p className="text-xs text-[var(--color-text-tertiary)] text-right">
          {filtered.length} von {invoices.length} Rechnungen angezeigt
        </p>
      )}
    </div>
  );
}

// ─── Desktop Table Row ──────────────────────────────────────────

function InvoiceRow({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: InvoiceData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = STATUS_CONFIG[invoice.status];
  const isDueSoon =
    invoice.status === "SENT" &&
    new Date(invoice.dueDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors hover:bg-black/[0.02]",
          isExpanded && "bg-black/[0.02]"
        )}
      >
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-[var(--color-text)] whitespace-nowrap">
          {invoice.invoiceNumber}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--color-text)] max-w-[200px] truncate">
          {invoice.customerName}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
          {formatDate(invoice.issueDate)}
        </td>
        <td
          className={cn(
            "px-4 py-3 text-sm whitespace-nowrap",
            isDueSoon
              ? "text-amber-600 font-medium"
              : "text-[var(--color-text-secondary)]"
          )}
        >
          {formatDate(invoice.dueDate)}
        </td>
        <td className="px-4 py-3 text-sm font-mono tabular-nums text-right text-[var(--color-text)] whitespace-nowrap">
          {formatCurrency(invoice.total)}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-0 py-0">
            <InvoiceActions invoice={invoice} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Mobile Card ────────────────────────────────────────────────

function InvoiceMobileCard({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: InvoiceData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = STATUS_CONFIG[invoice.status];

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full text-left px-4 py-3.5 transition-colors hover:bg-black/[0.02]",
          isExpanded && "bg-black/[0.02]"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-[var(--color-text)]">
                {invoice.invoiceNumber}
              </span>
              <Badge variant={statusConfig.variant} className="text-[10px]">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-text)] truncate">
              {invoice.customerName}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {formatDate(invoice.issueDate)} &middot; Fällig{" "}
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-mono tabular-nums font-medium text-[var(--color-text)]">
              {formatCurrency(invoice.total)}
            </p>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)] mt-1 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] mt-1 ml-auto" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && <InvoiceActions invoice={invoice} />}
    </div>
  );
}

// ─── Invoice Actions Panel ──────────────────────────────────────

function InvoiceActions({ invoice }: { invoice: InvoiceData }) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  async function handleAction(action: "send" | "paid" | "cancel" | "delete") {
    if (isLoading) return;

    const confirmMessages: Record<string, string> = {
      send: "Rechnung als versendet markieren? Dies erstellt eine Buchung.",
      paid: "Rechnung als bezahlt markieren?",
      cancel: "Rechnung stornieren?",
      delete: "Entwurf endgültig löschen?",
    };

    if (!confirm(confirmMessages[action])) return;

    setIsLoading(action);

    try {
      const urlMap: Record<string, { url: string; method: string }> = {
        send: { url: `/api/invoices/${invoice.id}/send`, method: "POST" },
        paid: { url: `/api/invoices/${invoice.id}/paid`, method: "POST" },
        cancel: { url: `/api/invoices/${invoice.id}/cancel`, method: "POST" },
        delete: { url: `/api/invoices/${invoice.id}`, method: "DELETE" },
      };

      const { url, method } = urlMap[action];
      const res = await fetch(url, { method });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Ein Fehler ist aufgetreten.");
        return;
      }

      window.location.reload();
    } catch {
      alert("Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(null);
    }
  }

  function handlePrint() {
    window.open(`/api/invoices/${invoice.id}/html`, "_blank");
  }

  // Parse line items for detail view
  let lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[] = [];
  try {
    lineItems = JSON.parse(invoice.lineItems);
  } catch {
    // ignore parse errors
  }

  return (
    <div className="px-6 py-4 bg-black/[0.015] border-t border-[var(--glass-border)]">
      {/* Line items detail */}
      {lineItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Positionen
          </p>
          <div className="space-y-1">
            {lineItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1"
              >
                <span className="text-[var(--color-text)] flex-1 min-w-0 truncate mr-4">
                  {item.description}
                </span>
                <span className="text-[var(--color-text-secondary)] whitespace-nowrap mr-4">
                  {item.quantity} x{" "}
                  <span className="font-mono tabular-nums">
                    {formatCurrency(item.unitPrice)}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-right text-[var(--color-text)] whitespace-nowrap">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[var(--glass-border)] space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">
                Nettobetrag
              </span>
              <span className="font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">MwSt</span>
              <span className="font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(invoice.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-[var(--color-text)]">Bruttobetrag</span>
              <span className="font-mono tabular-nums text-[var(--color-text)]">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {invoice.status === "DRAFT" && (
          <>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Button size="sm" variant="secondary">
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Button>
            </Link>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleAction("send")}
              disabled={isLoading !== null}
            >
              {isLoading === "send" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Versenden
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleAction("delete")}
              disabled={isLoading !== null}
            >
              {isLoading === "delete" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Löschen
            </Button>
          </>
        )}

        {invoice.status === "SENT" && (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleAction("paid")}
              disabled={isLoading !== null}
            >
              {isLoading === "paid" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Als bezahlt markieren
            </Button>
            <Button size="sm" variant="secondary" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Drucken/PDF
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleAction("cancel")}
              disabled={isLoading !== null}
            >
              {isLoading === "cancel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Stornieren
            </Button>
          </>
        )}

        {invoice.status === "OVERDUE" && (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleAction("paid")}
              disabled={isLoading !== null}
            >
              {isLoading === "paid" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Als bezahlt markieren
            </Button>
            <Button size="sm" variant="secondary" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Drucken/PDF
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleAction("cancel")}
              disabled={isLoading !== null}
            >
              {isLoading === "cancel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Stornieren
            </Button>
          </>
        )}

        {invoice.status === "PAID" && (
          <Button size="sm" variant="secondary" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Drucken/PDF
          </Button>
        )}
      </div>
    </div>
  );
}
