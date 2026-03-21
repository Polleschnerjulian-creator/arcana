"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NewAccountForm } from "@/components/accounts/new-account-form";

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  category: string;
  isSystem: boolean;
  isActive: boolean;
}

interface AccountGroup {
  type: string;
  label: string;
  sublabel: string;
  accounts: Account[];
}

interface AccountsTableProps {
  groups: AccountGroup[];
}

type FilterTab = "ALL" | "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "Alle" },
  { key: "ASSET", label: "Aktiva" },
  { key: "LIABILITY", label: "Passiva" },
  { key: "REVENUE", label: "Erloese" },
  { key: "EXPENSE", label: "Aufwand" },
];

const TYPE_BADGE_CONFIG: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  ASSET: { label: "Aktiva", variant: "info" },
  LIABILITY: { label: "Passiva", variant: "warning" },
  EQUITY: { label: "Eigenkapital", variant: "info" },
  REVENUE: { label: "Erloese", variant: "success" },
  EXPENSE: { label: "Aufwand", variant: "danger" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ANLAGE: "Anlagevermögen",
  UMLAUF: "Umlaufvermögen",
  EIGENKAPITAL: "Eigenkapital",
  ERLOES: "Erlöse",
  AUFWAND: "Aufwand",
};

export function AccountsTable({ groups }: AccountsTableProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => {
        if (activeTab === "ALL") return true;
        // EQUITY shows under LIABILITY/Passiva filter
        if (activeTab === "LIABILITY")
          return group.type === "LIABILITY" || group.type === "EQUITY";
        return group.type === activeTab;
      })
      .map((group) => ({
        ...group,
        accounts: group.accounts.filter((account) => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return (
            account.number.toLowerCase().includes(query) ||
            account.name.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((group) => group.accounts.length > 0);
  }, [groups, activeTab, searchQuery]);

  const totalFiltered = filteredGroups.reduce(
    (sum, g) => sum + g.accounts.length,
    0
  );

  async function handleToggleActive(account: Account) {
    if (account.isSystem) return;

    setTogglingIds((prev) => new Set(prev).add(account.id));

    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });

      if (res.ok) {
        // Optimistic update — toggle in-place via full page refresh
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to toggle account:", error);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: Filter Tabs + Search + New Account */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="w-64">
            <Input
              placeholder="Konto suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>

          {/* New Account Button */}
          <Button
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="whitespace-nowrap"
          >
            <svg
              className="h-4 w-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Neues Konto
          </Button>
        </div>
      </div>

      {/* New Account Form (inline) */}
      {showNewForm && (
        <NewAccountForm onClose={() => setShowNewForm(false)} />
      )}

      {/* Account Groups */}
      {filteredGroups.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <p className="text-text-secondary text-sm">
              {searchQuery
                ? `Keine Konten gefunden fuer "${searchQuery}"`
                : "Keine Konten in dieser Kategorie."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map((group) => (
            <Card key={group.type} className="overflow-hidden">
              {/* Group Header */}
              <div className="border-b border-border bg-gray-50/50 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-text-primary">
                      {group.label}
                    </h2>
                    <span className="text-xs text-text-muted">
                      {group.sublabel}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {group.accounts.length}{" "}
                    {group.accounts.length === 1 ? "Konto" : "Konten"}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-32">
                        Kontonr.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Kontoname
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-28">
                        Typ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-40">
                        Kategorie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider w-28">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-20">
                        {/* Actions */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.accounts.map((account) => {
                      const typeConfig = TYPE_BADGE_CONFIG[account.type];
                      const isToggling = togglingIds.has(account.id);

                      return (
                        <tr
                          key={account.id}
                          className={cn(
                            "transition-colors hover:bg-gray-50/50",
                            !account.isActive && "opacity-50"
                          )}
                        >
                          {/* Account Number */}
                          <td className="px-6 py-3">
                            <span className="font-mono tabular-nums text-sm font-medium text-text-primary">
                              {account.number}
                            </span>
                          </td>

                          {/* Account Name */}
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-primary">
                                {account.name}
                              </span>
                              {account.isSystem && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] px-1.5 py-0 opacity-60"
                                >
                                  System
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-3">
                            {typeConfig && (
                              <Badge variant={typeConfig.variant}>
                                {typeConfig.label}
                              </Badge>
                            )}
                          </td>

                          {/* Category */}
                          <td className="px-6 py-3">
                            <span className="text-sm text-text-secondary">
                              {CATEGORY_LABELS[account.category] ??
                                account.category}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-3">
                            <Badge
                              variant={
                                account.isActive ? "success" : "default"
                              }
                            >
                              {account.isActive ? "Aktiv" : "Inaktiv"}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-3 text-right">
                            {!account.isSystem && (
                              <button
                                onClick={() => handleToggleActive(account)}
                                disabled={isToggling}
                                className={cn(
                                  "text-xs font-medium transition-colors",
                                  account.isActive
                                    ? "text-text-muted hover:text-danger"
                                    : "text-text-muted hover:text-success",
                                  isToggling && "opacity-50 cursor-wait"
                                )}
                              >
                                {isToggling
                                  ? "..."
                                  : account.isActive
                                    ? "Deaktivieren"
                                    : "Aktivieren"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          {/* Summary footer */}
          <div className="text-center py-2">
            <span className="text-xs text-text-muted">
              {totalFiltered}{" "}
              {totalFiltered === 1 ? "Konto" : "Konten"} angezeigt
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
