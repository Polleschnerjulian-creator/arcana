"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface AccountOption {
  id: string;
  number: string;
  name: string;
}

interface AddBankAccountDialogProps {
  accounts: AccountOption[];
  onClose: () => void;
}

export function AddBankAccountDialog({
  accounts,
  onClose,
}: AddBankAccountDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    if (!accountId) {
      setError("Bitte ein verknüpftes Konto auswählen.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bank/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          iban: iban.trim() || undefined,
          bic: bic.trim() || undefined,
          accountId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Erstellen des Bankkontos.");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  // Format IBAN with spaces for display
  function handleIbanChange(value: string) {
    const clean = value.replace(/\s/g, "").toUpperCase();
    setIban(clean);
  }

  const formatIban = (raw: string) => {
    return raw.replace(/(.{4})/g, "$1 ").trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 animate-in"
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Bankkonto hinzufügen
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-3 text-sm text-red-500 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <Input
            label="Kontobezeichnung"
            placeholder="z.B. Geschäftskonto, Sparkonto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="IBAN (optional)"
            placeholder="DE89 3704 0044 0532 0130 00"
            value={formatIban(iban)}
            onChange={(e) => handleIbanChange(e.target.value)}
          />

          <Input
            label="BIC (optional)"
            placeholder="COBADEFFXXX"
            value={bic}
            onChange={(e) => setBic(e.target.value.toUpperCase())}
          />

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Verknüpftes Konto im Kontenplan
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-white/60 backdrop-blur-sm px-4 py-2.5 text-sm text-[var(--color-text)] shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
              required
            >
              <option value="">Konto auswählen...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.number} — {acc.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Typisch: 1200 Bank oder 1210 Bank 2
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Wird erstellt..." : "Bankkonto erstellen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
