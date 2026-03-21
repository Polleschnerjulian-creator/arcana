"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { MatchingDialog } from "@/components/bank/matching-dialog";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  CreditCard,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

export interface BankTransactionData {
  id: string;
  date: string;
  amount: number;
  description: string;
  counterpartName: string | null;
  counterpartIban: string | null;
  matchStatus: "UNMATCHED" | "AI_SUGGESTED" | "CONFIRMED" | "MANUAL";
  matchConfidence: number | null;
  matchedTransactionId: string | null;
  matchedTransaction: {
    id: string;
    description: string;
    reference: string | null;
  } | null;
}

export interface BankAccountData {
  id: string;
  name: string;
  iban: string | null;
  bic: string | null;
  lastImportAt: string | null;
  account: { id: string; number: string; name: string };
  transactions: BankTransactionData[];
}

interface BankOverviewProps {
  accounts: BankAccountData[];
}

// ─── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BankTransactionData["matchStatus"],
  { label: string; variant: "danger" | "warning" | "success" | "info" }
> = {
  UNMATCHED: { label: "Offen", variant: "danger" },
  AI_SUGGESTED: { label: "KI-Vorschlag", variant: "warning" },
  CONFIRMED: { label: "Bestätigt", variant: "success" },
  MANUAL: { label: "Manuell", variant: "info" },
};

// ─── IBAN Formatting ────────────────────────────────────────────

function formatIban(iban: string | null): string {
  if (!iban) return "—";
  const clean = iban.replace(/\s/g, "");
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

// ─── Component ──────────────────────────────────────────────────

export function BankOverview({ accounts }: BankOverviewProps) {
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(
    accounts.length === 1 ? accounts[0].id : null
  );
  const [matchingTransaction, setMatchingTransaction] =
    useState<BankTransactionData | null>(null);
  const [matchingBankAccountId, setMatchingBankAccountId] = useState<
    string | null
  >(null);
  const router = useRouter();

  function toggleAccount(id: string) {
    setExpandedAccountId((prev) => (prev === id ? null : id));
  }

  function openMatching(transaction: BankTransactionData, bankAccountId: string) {
    setMatchingTransaction(transaction);
    setMatchingBankAccountId(bankAccountId);
  }

  function closeMatching() {
    setMatchingTransaction(null);
    setMatchingBankAccountId(null);
  }

  return (
    <>
      <div className="space-y-4">
        {accounts.map((account) => {
          const isExpanded = expandedAccountId === account.id;
          const unmatchedCount = account.transactions.filter(
            (t) => t.matchStatus === "UNMATCHED"
          ).length;
          const aiSuggestedCount = account.transactions.filter(
            (t) => t.matchStatus === "AI_SUGGESTED"
          ).length;

          return (
            <Card key={account.id} className="overflow-hidden">
              {/* Account Header */}
              <button
                onClick={() => toggleAccount(account.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {account.name}
                      </h3>
                      <span className="text-xs text-text-muted font-mono">
                        {account.account.number} {account.account.name}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">
                      {formatIban(account.iban)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Status badges */}
                  <div className="flex items-center gap-2">
                    {unmatchedCount > 0 && (
                      <Badge variant="danger">
                        {unmatchedCount} offen
                      </Badge>
                    )}
                    {aiSuggestedCount > 0 && (
                      <Badge variant="warning">
                        {aiSuggestedCount} Vorschläge
                      </Badge>
                    )}
                    {unmatchedCount === 0 && aiSuggestedCount === 0 && (
                      <Badge variant="success">Alle zugeordnet</Badge>
                    )}
                  </div>

                  {/* Last import */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-text-muted">Letzter Import</p>
                    <p className="text-xs text-text-secondary">
                      {account.lastImportAt
                        ? formatDate(account.lastImportAt)
                        : "—"}
                    </p>
                  </div>

                  {/* Transaction count */}
                  <div className="text-right hidden sm:block min-w-[60px]">
                    <p className="text-xs text-text-muted">Umsätze</p>
                    <p className="text-sm font-medium text-text-primary">
                      {account.transactions.length}
                    </p>
                  </div>

                  {/* Chevron */}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  )}
                </div>
              </button>

              {/* Expanded: Transaction List */}
              {isExpanded && (
                <div className="border-t border-border">
                  {account.transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                      <CreditCard className="h-8 w-8 text-text-muted mb-2" />
                      <p className="text-sm font-medium">
                        Keine Umsätze importiert
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Importieren Sie Umsätze über CSV oder MT940.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-gray-50/50">
                            <th className="px-5 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Datum
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Betrag
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Beschreibung
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Gegenpartei
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Aktionen
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {account.transactions.map((tx) => (
                            <TransactionRow
                              key={tx.id}
                              transaction={tx}
                              bankAccountId={account.id}
                              onMatch={openMatching}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Matching Dialog */}
      {matchingTransaction && matchingBankAccountId && (
        <MatchingDialog
          transaction={matchingTransaction}
          bankAccountId={matchingBankAccountId}
          onClose={closeMatching}
          onMatched={() => {
            closeMatching();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─── Transaction Row ────────────────────────────────────────────

function TransactionRow({
  transaction,
  bankAccountId,
  onMatch,
}: {
  transaction: BankTransactionData;
  bankAccountId: string;
  onMatch: (tx: BankTransactionData, bankAccountId: string) => void;
}) {
  const router = useRouter();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const status = STATUS_CONFIG[transaction.matchStatus];
  const isPositive = transaction.amount >= 0;

  async function handleConfirm() {
    setConfirmLoading(true);
    try {
      const res = await fetch(
        `/api/bank/transactions/${transaction.id}/confirm`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleReject() {
    setRejectLoading(true);
    try {
      const res = await fetch(
        `/api/bank/transactions/${transaction.id}/reject`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        router.refresh();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setRejectLoading(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      {/* Datum */}
      <td className="px-5 py-3 text-sm text-text-primary whitespace-nowrap">
        {formatDate(transaction.date)}
      </td>

      {/* Betrag */}
      <td
        className={cn(
          "px-4 py-3 text-sm font-mono tabular-nums text-right whitespace-nowrap font-medium",
          isPositive ? "text-success" : "text-danger"
        )}
      >
        {isPositive ? "+" : ""}
        {formatCurrency(transaction.amount)}
      </td>

      {/* Beschreibung */}
      <td className="px-4 py-3 text-sm text-text-primary max-w-[280px] truncate">
        {transaction.description}
      </td>

      {/* Gegenpartei */}
      <td className="px-4 py-3 text-sm text-text-secondary max-w-[200px] truncate">
        {transaction.counterpartName || "—"}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>

      {/* Aktionen */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {transaction.matchStatus === "UNMATCHED" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onMatch(transaction, bankAccountId)}
            >
              Zuordnen
            </Button>
          )}

          {transaction.matchStatus === "AI_SUGGESTED" && (
            <>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={confirmLoading || rejectLoading}
              >
                {confirmLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Bestätigen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReject}
                disabled={confirmLoading || rejectLoading}
              >
                {rejectLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Ablehnen
              </Button>
            </>
          )}

          {transaction.matchStatus === "CONFIRMED" &&
            transaction.matchedTransaction && (
              <span className="text-xs text-text-muted font-mono">
                {transaction.matchedTransaction.reference ||
                  transaction.matchedTransaction.id.slice(0, 8)}
              </span>
            )}

          {transaction.matchStatus === "MANUAL" &&
            transaction.matchedTransaction && (
              <span className="text-xs text-text-muted font-mono">
                {transaction.matchedTransaction.reference ||
                  transaction.matchedTransaction.id.slice(0, 8)}
              </span>
            )}
        </div>
      </td>
    </tr>
  );
}
