"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { Lock, Trash2, RotateCcw, Loader2 } from "lucide-react";

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

interface TransactionData {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  status: "DRAFT" | "BOOKED" | "CANCELLED";
  source: string;
  bookedAt: string | null;
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

interface TransactionDetailProps {
  transaction: TransactionData;
  onAction: (action: "book" | "storno" | "delete") => void;
  isLoading: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export function TransactionDetail({
  transaction,
  onAction,
  isLoading,
}: TransactionDetailProps) {
  const totalDebit = transaction.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = transaction.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className="border-t border-border bg-gray-50/30 px-8 py-5">
      {/* Storno reference info */}
      {transaction.stornoOf && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          Stornobuchung zu: {transaction.stornoOf.description}
          {transaction.stornoOf.reference &&
            ` (${transaction.stornoOf.reference})`}
        </div>
      )}

      {transaction.cancelledBy && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-800">
          Storniert durch: {transaction.cancelledBy.description}
          {transaction.cancelledBy.reference &&
            ` (${transaction.cancelledBy.reference})`}
        </div>
      )}

      {/* Lines table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="pb-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Konto
            </th>
            <th className="pb-2 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
              Soll
            </th>
            <th className="pb-2 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
              Haben
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {transaction.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-2 text-text-primary">
                <span className="font-mono text-text-secondary">
                  {line.account.number}
                </span>{" "}
                {line.account.name}
                {line.note && (
                  <span className="ml-2 text-text-muted text-xs">
                    ({line.note})
                  </span>
                )}
              </td>
              <td
                className={cn(
                  "py-2 text-right font-mono tabular-nums",
                  line.debit > 0 ? "text-red-600" : "text-text-muted"
                )}
              >
                {line.debit > 0 ? formatCurrency(line.debit) : "—"}
              </td>
              <td
                className={cn(
                  "py-2 text-right font-mono tabular-nums",
                  line.credit > 0 ? "text-green-600" : "text-text-muted"
                )}
              >
                {line.credit > 0 ? formatCurrency(line.credit) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="pt-2 text-xs font-medium text-text-secondary uppercase">
              Summe
            </td>
            <td className="pt-2 text-right font-mono tabular-nums text-sm font-semibold text-red-600">
              {formatCurrency(totalDebit)}
            </td>
            <td className="pt-2 text-right font-mono tabular-nums text-sm font-semibold text-green-600">
              {formatCurrency(totalCredit)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Booked info */}
      {transaction.bookedAt && transaction.bookedBy && (
        <p className="mt-3 text-xs text-text-muted">
          Festgeschrieben am{" "}
          {new Intl.DateTimeFormat("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(transaction.bookedAt))}{" "}
          von {transaction.bookedBy.name}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        {transaction.status === "DRAFT" && (
          <>
            <Button
              size="sm"
              onClick={() => onAction("book")}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Festschreiben
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onAction("delete")}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Löschen
            </Button>
          </>
        )}

        {transaction.status === "BOOKED" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAction("storno")}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Stornieren
          </Button>
        )}

        {transaction.status === "CANCELLED" && (
          <Badge variant="danger">Storniert</Badge>
        )}
      </div>
    </div>
  );
}
