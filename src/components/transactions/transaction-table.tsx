"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface TransactionLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  taxRate: number | null;
  note: string | null;
  account: { id: string; number: string; name: string };
  taxAccount: { id: string; number: string; name: string } | null;
}

export interface TransactionData {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  status: "DRAFT" | "BOOKED" | "CANCELLED";
  source: string;
  aiConfidence: number | null;
  bookedAt: string | null;
  createdAt: string;
  bookedBy: { id: string; name: string } | null;
  cancelledBy: {
    id: string;
    description: string;
    reference: string | null;
  } | null;
  stornoOf: {
    id: string;
    description: string;
    reference: string | null;
  } | null;
  lines: TransactionLine[];
}

type StatusFilter = "ALL" | "DRAFT" | "BOOKED" | "CANCELLED";

interface TransactionTableProps {
  transactions: TransactionData[];
}

// ─── Status Badge Helper ────────────────────────────────────────

const STATUS_CONFIG: Record<
  TransactionData["status"],
  { label: string; variant: "warning" | "success" | "danger" }
> = {
  DRAFT: { label: "Entwurf", variant: "warning" },
  BOOKED: { label: "Gebucht", variant: "success" },
  CANCELLED: { label: "Storniert", variant: "danger" },
};

// ─── Component ──────────────────────────────────────────────────

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Status filter
      if (statusFilter !== "ALL" && tx.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesDescription = tx.description.toLowerCase().includes(q);
        const matchesReference = tx.reference?.toLowerCase().includes(q);
        const matchesAccount = tx.lines.some(
          (line) =>
            line.account.number.includes(q) ||
            line.account.name.toLowerCase().includes(q)
        );
        if (!matchesDescription && !matchesReference && !matchesAccount) {
          return false;
        }
      }

      // Date range filter
      if (dateFrom) {
        const txDate = new Date(tx.date);
        const fromDate = new Date(dateFrom);
        if (txDate < fromDate) return false;
      }

      if (dateTo) {
        const txDate = new Date(tx.date);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (txDate > toDate) return false;
      }

      return true;
    });
  }, [transactions, statusFilter, searchQuery, dateFrom, dateTo]);

  // Get primary debit and credit accounts for the summary row
  function getPrimaryAccounts(lines: TransactionLine[]) {
    const debitLines = lines.filter((l) => l.debit > 0);
    const creditLines = lines.filter((l) => l.credit > 0);

    const sollKonto =
      debitLines.length === 1
        ? `${debitLines[0].account.number} ${debitLines[0].account.name}`
        : debitLines.length > 1
          ? `${debitLines[0].account.number} (+${debitLines.length - 1})`
          : "—";

    const habenKonto =
      creditLines.length === 1
        ? `${creditLines[0].account.number} ${creditLines[0].account.name}`
        : creditLines.length > 1
          ? `${creditLines[0].account.number} (+${creditLines.length - 1})`
          : "—";

    return { sollKonto, habenKonto };
  }

  function getTotalAmount(lines: TransactionLine[]) {
    return lines.reduce((sum, line) => sum + line.debit, 0);
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "Alle", count: transactions.length },
    {
      key: "DRAFT",
      label: "Entwürfe",
      count: transactions.filter((t) => t.status === "DRAFT").length,
    },
    {
      key: "BOOKED",
      label: "Gebucht",
      count: transactions.filter((t) => t.status === "BOOKED").length,
    },
    {
      key: "CANCELLED",
      label: "Storniert",
      count: transactions.filter((t) => t.status === "CANCELLED").length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          {/* Search */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </div>

          {/* Date range */}
          <div className="flex items-end gap-2">
            <Input
              type="date"
              label="Von"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              label="Bis"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
            />
          </div>
        </div>

        {/* New booking button */}
        <Link href="/transactions/new">
          <Button size="md">
            <Plus className="h-4 w-4" />
            Neue Buchung
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              statusFilter === tab.key
                ? "text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 text-xs",
                statusFilter === tab.key
                  ? "text-primary"
                  : "text-text-muted"
              )}
            >
              {tab.count}
            </span>
            {statusFilter === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <FileText className="h-10 w-10 mb-3 text-text-muted" />
            <p className="text-sm font-medium">Keine Buchungen gefunden</p>
            <p className="text-xs text-text-muted mt-1">
              {searchQuery || dateFrom || dateTo || statusFilter !== "ALL"
                ? "Versuchen Sie andere Filterkriterien."
                : "Erstellen Sie Ihre erste Buchung."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Belegnr.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Beschreibung
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Soll-Konto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Haben-Konto
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Betrag
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((tx) => {
                const isExpanded = expandedId === tx.id;
                const { sollKonto, habenKonto } = getPrimaryAccounts(
                  tx.lines
                );
                const amount = getTotalAmount(tx.lines);
                const statusConfig = STATUS_CONFIG[tx.status];

                return (
                  <TableRow
                    key={tx.id}
                    tx={tx}
                    isExpanded={isExpanded}
                    sollKonto={sollKonto}
                    habenKonto={habenKonto}
                    amount={amount}
                    statusConfig={statusConfig}
                    onToggle={() =>
                      setExpandedId(isExpanded ? null : tx.id)
                    }
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <p className="text-xs text-text-muted text-right">
          {filtered.length} von {transactions.length} Buchungen angezeigt
        </p>
      )}
    </div>
  );
}

// ─── Table Row (with expand/collapse) ───────────────────────────

function TableRow({
  tx,
  isExpanded,
  sollKonto,
  habenKonto,
  amount,
  statusConfig,
  onToggle,
}: {
  tx: TransactionData;
  isExpanded: boolean;
  sollKonto: string;
  habenKonto: string;
  amount: number;
  statusConfig: { label: string; variant: "warning" | "success" | "danger" };
  onToggle: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleAction(action: "book" | "storno" | "delete") {
    if (isLoading) return;

    const confirmMessages: Record<string, string> = {
      book: "Buchung festschreiben? Dieser Vorgang ist unwiderruflich (GoBD).",
      storno:
        "Buchung stornieren? Es wird eine Gegenbuchung erstellt.",
      delete: "Entwurf endgültig löschen?",
    };

    if (!confirm(confirmMessages[action])) return;

    setIsLoading(true);

    try {
      const urlMap: Record<string, { url: string; method: string }> = {
        book: {
          url: `/api/transactions/${tx.id}/book`,
          method: "POST",
        },
        storno: {
          url: `/api/transactions/${tx.id}/storno`,
          method: "POST",
        },
        delete: {
          url: `/api/transactions/${tx.id}`,
          method: "DELETE",
        },
      };

      const { url, method } = urlMap[action];
      const res = await fetch(url, { method });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Ein Fehler ist aufgetreten.");
        return;
      }

      // Reload the page to get fresh data
      window.location.reload();
    } catch {
      alert("Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50/80",
          isExpanded && "bg-gray-50/50"
        )}
      >
        {/* Expand icon */}
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-muted" />
          )}
        </td>

        {/* Datum */}
        <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
          {formatDate(tx.date)}
        </td>

        {/* Belegnr. */}
        <td className="px-4 py-3 text-sm text-text-secondary font-mono">
          {tx.reference || "—"}
        </td>

        {/* Beschreibung */}
        <td className="px-4 py-3 text-sm text-text-primary max-w-xs truncate">
          {tx.description}
        </td>

        {/* Soll-Konto */}
        <td className="px-4 py-3 text-sm text-red-600 whitespace-nowrap">
          {sollKonto}
        </td>

        {/* Haben-Konto */}
        <td className="px-4 py-3 text-sm text-green-600 whitespace-nowrap">
          {habenKonto}
        </td>

        {/* Betrag */}
        <td className="px-4 py-3 text-sm font-mono tabular-nums text-right text-text-primary whitespace-nowrap">
          {formatCurrency(amount)}
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </td>
      </tr>

      {/* Expanded detail view */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <TransactionDetail
              transaction={tx}
              onAction={handleAction}
              isLoading={isLoading}
            />
          </td>
        </tr>
      )}
    </>
  );
}
