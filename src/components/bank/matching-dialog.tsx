"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { BankTransactionData } from "@/components/bank/bank-overview";
import {
  X,
  Sparkles,
  Search,
  PenLine,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ArrowRight,
  FileText,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface MatchSuggestion {
  transactionId: string;
  description: string;
  reference: string | null;
  amount: number;
  date: string;
  confidence: number;
}

interface SearchResult {
  id: string;
  description: string;
  reference: string | null;
  date: string;
  amount: number;
  status: string;
}

interface MatchingDialogProps {
  transaction: BankTransactionData;
  bankAccountId: string;
  onClose: () => void;
  onMatched: () => void;
}

type Tab = "suggestions" | "manual" | "new";

// ─── Component ──────────────────────────────────────────────────

export function MatchingDialog({
  transaction,
  onClose,
  onMatched,
}: MatchingDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("suggestions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Suggestions tab state
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  // Manual tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // New booking tab state
  const [bookingLoading, setBookingLoading] = useState(false);

  const isPositive = transaction.amount >= 0;

  // ─── Fetch Suggestions ──────────────────────────────────────

  useEffect(() => {
    async function fetchSuggestions() {
      setSuggestionsLoading(true);
      try {
        const res = await fetch(
          `/api/bank/transactions/${transaction.id}/suggestions`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setSuggestions(data.data);
        }
      } catch {
        // No suggestions available
      } finally {
        setSuggestionsLoading(false);
      }
    }

    fetchSuggestions();
  }, [transaction.id]);

  // ─── Search Transactions ───────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        bankTransactionId: transaction.id,
      });
      const res = await fetch(
        `/api/bank/transactions/${transaction.id}/search?${params}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data);
      }
    } catch {
      // Search failed silently
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, transaction.id]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "manual" && searchQuery.trim()) {
        handleSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, handleSearch]);

  // ─── Match Transaction ─────────────────────────────────────

  async function handleMatch(transactionId: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/bank/transactions/${transaction.id}/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId }),
        }
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Zuordnung fehlgeschlagen.");
        return;
      }

      setSuccess(true);
      setTimeout(onMatched, 800);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Create Booking ────────────────────────────────────────

  async function handleCreateBooking() {
    setBookingLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/bank/transactions/${transaction.id}/book`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Buchung konnte nicht erstellt werden.");
        return;
      }

      setSuccess(true);
      setTimeout(onMatched, 800);
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setBookingLoading(false);
    }
  }

  // ─── Confidence Badge ──────────────────────────────────────

  function ConfidenceBadge({ confidence }: { confidence: number }) {
    if (confidence >= 0.85) {
      return (
        <Badge variant="success" className="inline-flex items-center gap-1 text-xs">
          <ShieldCheck className="h-3 w-3" />
          {Math.round(confidence * 100)}%
        </Badge>
      );
    }
    if (confidence >= 0.5) {
      return (
        <Badge variant="warning" className="inline-flex items-center gap-1 text-xs">
          <ShieldAlert className="h-3 w-3" />
          {Math.round(confidence * 100)}%
        </Badge>
      );
    }
    return (
      <Badge variant="danger" className="inline-flex items-center gap-1 text-xs">
        <Shield className="h-3 w-3" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }

  // ─── Tab Config ────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "suggestions",
      label: "Vorschläge",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      key: "manual",
      label: "Manuelle Zuordnung",
      icon: <Search className="h-4 w-4" />,
    },
    {
      key: "new",
      label: "Neue Buchung",
      icon: <PenLine className="h-4 w-4" />,
    },
  ];

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Umsatz zuordnen
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bank Transaction Summary */}
        <div className="border-b border-border bg-gray-50/50 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">
                {transaction.description}
              </p>
              {transaction.counterpartName && (
                <p className="text-xs text-text-secondary">
                  {transaction.counterpartName}
                  {transaction.counterpartIban && (
                    <span className="font-mono ml-2">
                      {transaction.counterpartIban
                        .replace(/\s/g, "")
                        .replace(/(.{4})/g, "$1 ")
                        .trim()}
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs text-text-muted">
                {formatDate(transaction.date)}
              </p>
            </div>
            <div
              className={cn(
                "text-lg font-mono tabular-nums font-semibold",
                isPositive ? "text-success" : "text-danger"
              )}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(transaction.amount)}
            </div>
          </div>
        </div>

        {/* Success overlay */}
        {success && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light mb-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <p className="text-sm font-medium text-success">
              Erfolgreich zugeordnet
            </p>
          </div>
        )}

        {!success && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
                    activeTab === tab.key
                      ? "text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[300px]">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-danger-light border border-red-200 p-3 mb-4">
                  <AlertCircle className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {/* Suggestions Tab */}
              {activeTab === "suggestions" && (
                <div className="space-y-3">
                  {suggestionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      <span className="text-sm text-text-secondary ml-2">
                        Vorschläge werden geladen...
                      </span>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Sparkles className="h-8 w-8 text-text-muted mb-3" />
                      <p className="text-sm font-medium text-text-secondary">
                        Keine Vorschläge verfügbar
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Versuchen Sie die manuelle Zuordnung oder erstellen Sie
                        eine neue Buchung.
                      </p>
                    </div>
                  ) : (
                    suggestions.map((suggestion) => (
                      <div
                        key={suggestion.transactionId}
                        className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {suggestion.description}
                            </p>
                            <ConfidenceBadge
                              confidence={suggestion.confidence}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-secondary">
                            <span>{formatDate(suggestion.date)}</span>
                            {suggestion.reference && (
                              <span className="font-mono">
                                {suggestion.reference}
                              </span>
                            )}
                            <span
                              className={cn(
                                "font-mono font-medium tabular-nums",
                                suggestion.amount >= 0
                                  ? "text-success"
                                  : "text-danger"
                              )}
                            >
                              {formatCurrency(suggestion.amount)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="ml-4 flex-shrink-0"
                          onClick={() =>
                            handleMatch(suggestion.transactionId)
                          }
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          Zuordnen
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Manual Search Tab */}
              {activeTab === "manual" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buchung suchen (Beschreibung, Belegnr.)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                      autoFocus
                    />
                  </div>

                  {searchLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                  )}

                  {!searchLoading && searchQuery && searchResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="h-8 w-8 text-text-muted mb-2" />
                      <p className="text-sm text-text-secondary">
                        Keine Buchungen gefunden
                      </p>
                    </div>
                  )}

                  {!searchLoading && !searchQuery && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Search className="h-8 w-8 text-text-muted mb-2" />
                      <p className="text-sm text-text-secondary">
                        Suchen Sie nach einer bestehenden Buchung
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Geben Sie eine Beschreibung oder Belegnummer ein
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {result.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-text-secondary">
                            <span>{formatDate(result.date)}</span>
                            {result.reference && (
                              <span className="font-mono">
                                {result.reference}
                              </span>
                            )}
                            <span
                              className={cn(
                                "font-mono font-medium tabular-nums",
                                result.amount >= 0
                                  ? "text-success"
                                  : "text-danger"
                              )}
                            >
                              {formatCurrency(result.amount)}
                            </span>
                            <Badge
                              variant={
                                result.status === "BOOKED"
                                  ? "success"
                                  : result.status === "DRAFT"
                                    ? "warning"
                                    : "default"
                              }
                            >
                              {result.status === "BOOKED"
                                ? "Gebucht"
                                : result.status === "DRAFT"
                                  ? "Entwurf"
                                  : result.status}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="ml-4 flex-shrink-0"
                          onClick={() => handleMatch(result.id)}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          Zuordnen
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Booking Tab */}
              {activeTab === "new" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-gray-50/50 p-4 space-y-3">
                    <p className="text-sm font-medium text-text-primary">
                      Neue Buchung aus Bankumsatz erstellen
                    </p>
                    <p className="text-xs text-text-secondary">
                      Es wird automatisch eine Buchung basierend auf den
                      Umsatzdaten erstellt. Die KI versucht, das passende
                      Gegenkonto zu ermitteln.
                    </p>

                    <div className="border-t border-border pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                            Datum
                          </p>
                          <p className="text-text-primary">
                            {formatDate(transaction.date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                            Betrag
                          </p>
                          <p
                            className={cn(
                              "font-mono tabular-nums font-medium",
                              isPositive ? "text-success" : "text-danger"
                            )}
                          >
                            {isPositive ? "+" : ""}
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                            Beschreibung
                          </p>
                          <p className="text-text-primary">
                            {transaction.description}
                          </p>
                        </div>
                        {transaction.counterpartName && (
                          <div className="col-span-2">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                              Gegenpartei
                            </p>
                            <p className="text-text-secondary">
                              {transaction.counterpartName}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateBooking}
                    disabled={bookingLoading}
                    className="w-full"
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Wird erstellt...
                      </>
                    ) : (
                      <>
                        <PenLine className="h-4 w-4" />
                        Buchung erstellen
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
