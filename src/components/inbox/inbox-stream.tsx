"use client";

import * as React from "react";
import {
  FileText,
  Building2,
  Mail,
  Check,
  Pencil,
  SkipForward,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  type: "DOCUMENT" | "BANK_TRANSACTION" | "INVOICE_DRAFT" | "EMAIL_IMPORT";
  source: string;
  title: string;
  subtitle: string;
  amount: number | null;
  date: string;
  status: "PENDING" | "READY" | "ACTION_NEEDED";
  linkedDocumentId: string | null;
  linkedTransactionId: string | null;
  linkedBankTransactionId: string | null;
  aiSuggestion: {
    vendor?: string;
    amount?: number;
    taxRate?: number;
    confidence?: number;
    debitAccount?: string;
    creditAccount?: string;
  } | null;
  createdAt: string;
}

interface InboxData {
  items: InboxItem[];
  counts: {
    total: number;
    ready: number;
    actionNeeded: number;
    pending: number;
  };
}

// ─── Format Helpers ───────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Type Icon ────────────────────────────────────────────────────

function TypeIcon({ type }: { type: InboxItem["type"] }) {
  switch (type) {
    case "DOCUMENT":
      return <FileText className="h-5 w-5" strokeWidth={1.5} />;
    case "BANK_TRANSACTION":
      return <Building2 className="h-5 w-5" strokeWidth={1.5} />;
    case "EMAIL_IMPORT":
      return <Mail className="h-5 w-5" strokeWidth={1.5} />;
    default:
      return <FileText className="h-5 w-5" strokeWidth={1.5} />;
  }
}

// ─── Status Indicator ─────────────────────────────────────────────

function StatusIndicator({ status }: { status: InboxItem["status"] }) {
  switch (status) {
    case "PENDING":
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
        </div>
      );
    case "READY":
      return (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
        </div>
      );
    case "ACTION_NEEDED":
      return (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
      );
  }
}

// ─── Filter Tabs ──────────────────────────────────────────────────

type FilterTab = "ALL" | "READY" | "ACTION_NEEDED" | "PENDING";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "Alle" },
  { key: "READY", label: "Bereit" },
  { key: "ACTION_NEEDED", label: "Offen" },
  { key: "PENDING", label: "In Bearbeitung" },
];

// ─── Main Component ───────────────────────────────────────────────

export function InboxStream() {
  const [data, setData] = React.useState<InboxData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<FilterTab>("ALL");
  const [processingIds, setProcessingIds] = React.useState<Set<string>>(
    new Set()
  );
  const [batchConfirming, setBatchConfirming] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);

  // ─── Fetch inbox data ──────────────────────────────────────
  const fetchInbox = React.useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      // Silent fail on poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling every 10s
  React.useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 10000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  // ─── Confirm action ────────────────────────────────────────
  async function handleConfirm(item: InboxItem) {
    const sourceId =
      item.linkedTransactionId || item.linkedBankTransactionId || "";
    if (!sourceId) return;

    setProcessingIds((prev) => new Set(prev).add(item.id));

    try {
      const res = await fetch(`/api/inbox/${item.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, sourceId }),
      });

      if (res.ok) {
        // Remove from local state immediately
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((i) => i.id !== item.id),
                counts: {
                  ...prev.counts,
                  total: prev.counts.total - 1,
                  ready:
                    item.status === "READY"
                      ? prev.counts.ready - 1
                      : prev.counts.ready,
                  actionNeeded:
                    item.status === "ACTION_NEEDED"
                      ? prev.counts.actionNeeded - 1
                      : prev.counts.actionNeeded,
                  pending:
                    item.status === "PENDING"
                      ? prev.counts.pending - 1
                      : prev.counts.pending,
                },
              }
            : prev
        );
      }
    } catch {
      // Show error state
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // ─── Dismiss action ────────────────────────────────────────
  async function handleDismiss(item: InboxItem) {
    const sourceId =
      item.linkedTransactionId || item.linkedBankTransactionId || "";
    if (!sourceId) return;

    setProcessingIds((prev) => new Set(prev).add(item.id));

    try {
      const res = await fetch(`/api/inbox/${item.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, sourceId }),
      });

      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((i) => i.id !== item.id),
                counts: {
                  ...prev.counts,
                  total: prev.counts.total - 1,
                  ready:
                    item.status === "READY"
                      ? prev.counts.ready - 1
                      : prev.counts.ready,
                  actionNeeded:
                    item.status === "ACTION_NEEDED"
                      ? prev.counts.actionNeeded - 1
                      : prev.counts.actionNeeded,
                  pending:
                    item.status === "PENDING"
                      ? prev.counts.pending - 1
                      : prev.counts.pending,
                },
              }
            : prev
        );
      }
    } catch {
      // Show error state
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // ─── Batch confirm all READY items ─────────────────────────
  async function handleBatchConfirm() {
    if (!data) return;
    const readyItems = data.items.filter((i) => i.status === "READY");
    if (readyItems.length === 0) return;

    setBatchConfirming(true);
    setBatchProgress({ current: 0, total: readyItems.length });

    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      setBatchProgress({ current: i + 1, total: readyItems.length });
      await handleConfirm(item);
      // Small delay between confirms to avoid overwhelming the server
      if (i < readyItems.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setBatchConfirming(false);
    setBatchProgress(null);
    // Refresh data
    await fetchInbox();
  }

  // ─── Filter items ──────────────────────────────────────────
  const filteredItems = React.useMemo(() => {
    if (!data) return [];
    if (activeTab === "ALL") return data.items;
    return data.items.filter((i) => i.status === activeTab);
  }, [data, activeTab]);

  // ─── Get tab count ─────────────────────────────────────────
  function getTabCount(tab: FilterTab): number {
    if (!data) return 0;
    switch (tab) {
      case "ALL":
        return data.counts.total;
      case "READY":
        return data.counts.ready;
      case "ACTION_NEEDED":
        return data.counts.actionNeeded;
      case "PENDING":
        return data.counts.pending;
    }
  }

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return null; // Server-side loading.tsx handles this
  }

  // ─── Empty state ───────────────────────────────────────────
  if (!data || data.counts.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 mb-6">
          <Check className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-semibold text-[var(--color-text)] mb-2">
          Alles erledigt!
        </h2>
        <p className="text-[var(--color-text-secondary)] text-center max-w-md leading-relaxed">
          Keine offenen Posten. Laden Sie einen Beleg hoch oder importieren Sie
          Bankumsätze.
        </p>
        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/documents/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 dark:bg-white px-5 py-2.5 text-sm font-medium text-white dark:text-black shadow-sm hover:opacity-90 transition-opacity"
          >
            <FileText className="h-4 w-4" />
            Beleg hochladen
          </Link>
          <Link
            href="/bank/import"
            className="inline-flex items-center gap-2 rounded-xl glass px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--glass-bg-hover)] transition-colors"
          >
            <Building2 className="h-4 w-4" />
            Bank importieren
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Filter Tabs + Batch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl glass p-1">
          {FILTER_TABS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white dark:bg-white/[0.12] text-[var(--color-text)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none min-w-[18px] h-[18px] px-1",
                      isActive
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-black"
                        : "bg-black/[0.06] dark:bg-white/[0.08] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Batch Confirm Button */}
        {data.counts.ready > 0 && (
          <button
            onClick={handleBatchConfirm}
            disabled={batchConfirming}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 shadow-sm",
              batchConfirming
                ? "bg-neutral-400 dark:bg-neutral-600 text-white cursor-wait"
                : "bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90"
            )}
          >
            {batchConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {batchProgress
                  ? `${batchProgress.current}/${batchProgress.total}`
                  : "..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Alle bestätigen ({data.counts.ready})
              </>
            )}
          </button>
        )}
      </div>

      {/* Batch Progress Bar */}
      {batchProgress && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-text)]">
              Buchungen werden bestätigt...
            </span>
            <span className="text-sm text-[var(--color-text-secondary)] font-mono tabular-nums">
              {batchProgress.current}/{batchProgress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-neutral-900 dark:bg-white transition-all duration-300 ease-out"
              style={{
                width: `${(batchProgress.current / batchProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Inbox Items Stream */}
      <div className="space-y-2">
        {filteredItems.map((item, index) => (
          <InboxCard
            key={item.id}
            item={item}
            index={index}
            isProcessing={processingIds.has(item.id)}
            onConfirm={() => handleConfirm(item)}
            onDismiss={() => handleDismiss(item)}
          />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredItems.length === 0 && data.counts.total > 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] mb-4">
            <Inbox className="h-6 w-6 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Keine Einträge mit diesem Filter.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Inbox Card Component ─────────────────────────────────────────

function InboxCard({
  item,
  index,
  isProcessing,
  onConfirm,
  onDismiss,
}: {
  item: InboxItem;
  index: number;
  isProcessing: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const isIncome = item.amount !== null && item.amount > 0;
  const isExpense = item.amount !== null && item.amount < 0;

  // Determine edit link based on type
  const editHref =
    item.type === "BANK_TRANSACTION"
      ? `/bank`
      : item.linkedDocumentId
        ? `/documents`
        : item.linkedTransactionId
          ? `/transactions`
          : null;

  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 sm:p-5 transition-all duration-200 group animate-in",
        isProcessing && "opacity-50 pointer-events-none",
        `delay-${Math.min(index + 1, 6)}`
      )}
    >
      <div className="flex items-start gap-4">
        {/* Left: Type Icon */}
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            item.status === "READY"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : item.status === "ACTION_NEEDED"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-black/[0.04] dark:bg-white/[0.06] text-[var(--color-text-tertiary)]"
          )}
        >
          <TypeIcon type={item.type} />
        </div>

        {/* Middle: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                {item.title}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {item.subtitle} · {formatDate(item.date)}
              </p>
            </div>

            {/* Right: Amount + Status */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {item.amount !== null && (
                <span
                  className={cn(
                    "text-base font-semibold font-mono tabular-nums",
                    isIncome && "text-emerald-500",
                    isExpense && "text-red-500",
                    !isIncome && !isExpense && "text-[var(--color-text)]"
                  )}
                >
                  {formatAmount(item.amount)}
                </span>
              )}
              <StatusIndicator status={item.status} />
            </div>
          </div>

          {/* AI Suggestion Preview */}
          {item.aiSuggestion &&
            item.aiSuggestion.debitAccount &&
            item.aiSuggestion.creditAccount && (
              <div className="mt-2.5 flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text)]">
                    S
                  </span>{" "}
                  {item.aiSuggestion.debitAccount}
                </span>
                <ArrowRight className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text)]">
                    H
                  </span>{" "}
                  {item.aiSuggestion.creditAccount}
                </span>
                {item.aiSuggestion.confidence != null && (
                  <span className="text-[var(--color-text-tertiary)] ml-1">
                    {Math.round(item.aiSuggestion.confidence * 100)}%
                  </span>
                )}
              </div>
            )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            {item.status === "READY" && (
              <>
                <button
                  onClick={onConfirm}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-white px-3.5 py-1.5 text-xs font-medium text-white dark:text-black shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Bestätigen
                </button>
                {editHref && (
                  <Link
                    href={editHref}
                    className="inline-flex items-center gap-1.5 rounded-lg glass px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--glass-bg-hover)] transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Bearbeiten
                  </Link>
                )}
              </>
            )}

            {item.status === "ACTION_NEEDED" && (
              <>
                {editHref && (
                  <Link
                    href={editHref}
                    className="inline-flex items-center gap-1.5 rounded-lg glass px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--glass-bg-hover)] transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Manuell buchen
                  </Link>
                )}
                <button
                  onClick={onDismiss}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SkipForward className="h-3.5 w-3.5" />
                  )}
                  Überspringen
                </button>
              </>
            )}

            {item.status === "PENDING" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Wird verarbeitet...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
