"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  calculateLinearDepreciation,
  calculateDepreciationSchedule,
} from "@/lib/accounting/afa";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface SerializedAsset {
  id: string;
  name: string;
  description: string | null;
  accountId: string;
  purchaseDate: string;
  purchasePrice: number;
  usefulLifeYears: number;
  depreciationMethod: string;
  residualValue: number;
  currentBookValue: number;
  isActive: boolean;
  disposalDate: string | null;
  disposalPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountOption {
  id: string;
  number: string;
  name: string;
}

interface AssetListProps {
  assets: SerializedAsset[];
  accounts: AccountOption[];
}

// ─── Component ──────────────────────────────────────────────────

export function AssetList({ assets, accounts }: AssetListProps) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  // ─── Form State ─────────────────────────────────────────────

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    accountId: accounts[0]?.id || "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchasePrice: "",
    usefulLifeYears: "",
    depreciationMethod: "LINEAR",
    residualValue: "0",
  });

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      accountId: accounts[0]?.id || "",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchasePrice: "",
      usefulLifeYears: "",
      depreciationMethod: "LINEAR",
      residualValue: "0",
    });
    setFormError(null);
  }

  // ─── Create Asset ───────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          accountId: formData.accountId,
          purchaseDate: formData.purchaseDate,
          purchasePrice: parseFloat(formData.purchasePrice),
          usefulLifeYears: parseInt(formData.usefulLifeYears, 10),
          depreciationMethod: formData.depreciationMethod,
          residualValue: parseFloat(formData.residualValue) || 0,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setFormError(json.error || "Fehler beim Erstellen.");
        return;
      }

      resetForm();
      setShowForm(false);
      router.refresh();
    } catch {
      setFormError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setCreating(false);
    }
  }

  // ─── Book Depreciation ─────────────────────────────────────

  async function handleDepreciate(assetId: string) {
    setLoading((prev) => ({ ...prev, [assetId]: true }));
    setError(null);

    try {
      const res = await fetch(`/api/assets/${assetId}/depreciate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: new Date().getFullYear() }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Fehler bei der AfA-Buchung.");
        return;
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading((prev) => ({ ...prev, [assetId]: false }));
    }
  }

  // ─── Delete Asset ──────────────────────────────────────────

  async function handleDelete(assetId: string) {
    if (!confirm("Anlage wirklich loeschen?")) return;

    setLoading((prev) => ({ ...prev, [`del-${assetId}`]: true }));
    setError(null);

    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Fehler beim Loeschen.");
        return;
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading((prev) => ({ ...prev, [`del-${assetId}`]: false }));
    }
  }

  // ─── Compute annual AfA for display ────────────────────────

  function getAnnualAfa(asset: SerializedAsset) {
    const { annualAmount } = calculateLinearDepreciation(
      asset.purchasePrice,
      asset.residualValue,
      asset.usefulLifeYears
    );
    return annualAmount;
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add Button */}
      <div className="flex justify-end">
        <Button
          variant={showForm ? "secondary" : "primary"}
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Abbrechen
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Anlage hinzufuegen
            </>
          )}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="glass rounded-2xl p-6 space-y-4"
        >
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            Neue Anlage erfassen
          </h3>

          {formError && (
            <div className="rounded-xl border border-red-500/15 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bezeichnung"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="z.B. MacBook Pro 16"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Anlagekonto
              </label>
              <select
                value={formData.accountId}
                onChange={(e) =>
                  setFormData({ ...formData, accountId: e.target.value })
                }
                required
                className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
              >
                {accounts.length === 0 && (
                  <option value="">Keine Anlagekonten vorhanden</option>
                )}
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.number} {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Anschaffungsdatum"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) =>
                setFormData({ ...formData, purchaseDate: e.target.value })
              }
              required
            />

            <Input
              label="Anschaffungskosten (EUR)"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.purchasePrice}
              onChange={(e) =>
                setFormData({ ...formData, purchasePrice: e.target.value })
              }
              placeholder="z.B. 2499.00"
              required
            />

            <Input
              label="Nutzungsdauer (Jahre)"
              type="number"
              min="1"
              max="99"
              value={formData.usefulLifeYears}
              onChange={(e) =>
                setFormData({ ...formData, usefulLifeYears: e.target.value })
              }
              placeholder="z.B. 3"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                AfA-Methode
              </label>
              <select
                value={formData.depreciationMethod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    depreciationMethod: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
              >
                <option value="LINEAR">Linear</option>
                <option value="DEGRESSIVE">Degressiv</option>
              </select>
            </div>

            <Input
              label="Restwert (EUR)"
              type="number"
              step="0.01"
              min="0"
              value={formData.residualValue}
              onChange={(e) =>
                setFormData({ ...formData, residualValue: e.target.value })
              }
              placeholder="0.00"
            />

            <Input
              label="Beschreibung (optional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Zusaetzliche Informationen..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                "Anlage erstellen"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Asset Table */}
      {assets.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/[0.06] mb-4">
            <TrendingDown className="h-6 w-6 text-[var(--color-text-tertiary)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            Keine Anlagen vorhanden
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-md mx-auto">
            Erfassen Sie Ihre Anlagegueter, um Abschreibungen automatisch zu berechnen und zu buchen.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="px-4 md:px-6 py-3 border-b border-[var(--glass-border)] hidden md:grid md:grid-cols-[2fr_1fr_1fr_0.8fr_1fr_1fr_auto] gap-4 items-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Bezeichnung</span>
            <span>Anschaffung</span>
            <span className="text-right">AK</span>
            <span className="text-center">ND</span>
            <span className="text-right">Buchwert</span>
            <span className="text-right">Jaehrl. AfA</span>
            <span className="w-[120px]" />
          </div>

          {/* Rows */}
          {assets.map((asset, idx) => {
            const isExpanded = expandedId === asset.id;
            const annualAfa = getAnnualAfa(asset);
            const depreciationPercent =
              asset.purchasePrice > 0
                ? Math.round(
                    ((asset.purchasePrice - asset.currentBookValue) /
                      asset.purchasePrice) *
                      100
                  )
                : 0;

            return (
              <div key={asset.id}>
                {/* Main Row */}
                <div
                  className={`px-4 md:px-6 py-3 md:grid md:grid-cols-[2fr_1fr_1fr_0.8fr_1fr_1fr_auto] gap-4 items-center ${
                    idx < assets.length - 1 || isExpanded
                      ? "border-b border-[var(--glass-border)]"
                      : ""
                  } hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors`}
                >
                  {/* Name + Status */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : asset.id)
                      }
                      className="flex-shrink-0 p-0.5 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[var(--color-text)] truncate block">
                        {asset.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)] md:hidden">
                        {formatDate(asset.purchaseDate)}
                      </span>
                    </div>
                    {!asset.isActive && (
                      <Badge variant="danger">Ausgeschieden</Badge>
                    )}
                  </div>

                  {/* Purchase Date */}
                  <span className="text-sm text-[var(--color-text-secondary)] hidden md:block">
                    {formatDate(asset.purchaseDate)}
                  </span>

                  {/* Purchase Price */}
                  <span className="text-sm text-[var(--color-text)] text-right hidden md:block">
                    {formatCurrency(asset.purchasePrice)}
                  </span>

                  {/* Useful Life */}
                  <span className="text-sm text-[var(--color-text-secondary)] text-center hidden md:block">
                    {asset.usefulLifeYears} J.
                  </span>

                  {/* Book Value */}
                  <div className="text-right hidden md:block">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {formatCurrency(asset.currentBookValue)}
                    </span>
                    <div className="mt-0.5 h-1.5 w-full rounded-full bg-gray-200/50 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-black/60 dark:bg-white/40 transition-all duration-500"
                        style={{
                          width: `${100 - depreciationPercent}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Annual AfA */}
                  <span className="text-sm text-[var(--color-text-secondary)] text-right hidden md:block">
                    {formatCurrency(annualAfa)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end mt-2 md:mt-0 w-[120px]">
                    {asset.isActive &&
                      asset.currentBookValue > asset.residualValue && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={loading[asset.id]}
                          onClick={() => handleDepreciate(asset.id)}
                          title="AfA buchen"
                        >
                          {loading[asset.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <TrendingDown className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">AfA</span>
                            </>
                          )}
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading[`del-${asset.id}`]}
                      onClick={() => handleDelete(asset.id)}
                      title="Loeschen"
                    >
                      {loading[`del-${asset.id}`] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded: Depreciation Schedule */}
                {isExpanded && (
                  <DepreciationSchedulePanel asset={asset} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Depreciation Schedule Panel ─────────────────────────────────

function DepreciationSchedulePanel({
  asset,
}: {
  asset: SerializedAsset;
}) {
  const schedule = calculateDepreciationSchedule({
    purchasePrice: asset.purchasePrice,
    purchaseDate: new Date(asset.purchaseDate),
    usefulLifeYears: asset.usefulLifeYears,
    residualValue: asset.residualValue,
    depreciationMethod: asset.depreciationMethod,
  });

  if (schedule.length === 0) {
    return (
      <div className="px-6 py-4 bg-black/[0.01] dark:bg-white/[0.01] border-b border-[var(--glass-border)]">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Kein Abschreibungsplan verfuegbar.
        </p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="px-4 md:px-6 py-4 bg-black/[0.015] dark:bg-white/[0.015] border-b border-[var(--glass-border)]">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
        Abschreibungsplan ({asset.depreciationMethod === "LINEAR" ? "Linear" : "Degressiv"})
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] border-b border-[var(--glass-border)]">
              <th className="py-2 pr-4 text-left">Jahr</th>
              <th className="py-2 px-4 text-right">Buchwert Anfang</th>
              <th className="py-2 px-4 text-right">AfA</th>
              <th className="py-2 pl-4 text-right">Buchwert Ende</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => (
              <tr
                key={row.year}
                className={`border-b border-[var(--glass-border)] last:border-0 ${
                  row.year === currentYear
                    ? "bg-black/[0.03] dark:bg-white/[0.03] font-medium"
                    : ""
                }`}
              >
                <td className="py-2 pr-4 text-[var(--color-text)]">
                  {row.year}
                  {row.year === currentYear && (
                    <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">
                      aktuell
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 text-right text-[var(--color-text-secondary)]">
                  {formatCurrency(row.openingValue)}
                </td>
                <td className="py-2 px-4 text-right text-red-600 dark:text-red-400">
                  -{formatCurrency(row.depreciation)}
                </td>
                <td className="py-2 pl-4 text-right text-[var(--color-text)]">
                  {formatCurrency(row.closingValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {asset.residualValue > 0 && (
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
          Restwert: {formatCurrency(asset.residualValue)}
        </p>
      )}
    </div>
  );
}
