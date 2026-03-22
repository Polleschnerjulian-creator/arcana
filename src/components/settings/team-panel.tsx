"use client";

import * as React from "react";
import {
  Crown,
  Shield,
  BookOpen,
  Eye,
  UserPlus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TeamPanelProps {
  members: TeamMember[];
  currentUserRole: string;
}

// ─── Role Config ────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ElementType;
  }
> = {
  OWNER: {
    label: "Inhaber",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Crown,
  },
  ADMIN: {
    label: "Admin",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: Shield,
  },
  BOOKKEEPER: {
    label: "Buchhalter",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: BookOpen,
  },
  VIEWER: {
    label: "Betrachter",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/20",
    icon: Eye,
  },
};

const ASSIGNABLE_ROLES = ["ADMIN", "BOOKKEEPER", "VIEWER"] as const;

// ─── Component ──────────────────────────────────────────────────

export function TeamPanel({ members, currentUserRole }: TeamPanelProps) {
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>(members);
  const [showInviteForm, setShowInviteForm] = React.useState(false);
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [inviteError, setInviteError] = React.useState("");
  const [tempPassword, setTempPassword] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  // Invite form fields
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteRole, setInviteRole] =
    React.useState<(typeof ASSIGNABLE_ROLES)[number]>("BOOKKEEPER");

  // Role editing
  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);

  const canInvite = ["OWNER", "ADMIN"].includes(currentUserRole);
  const canManage = currentUserRole === "OWNER";

  // ─── Invite Handler ─────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setTempPassword("");
    setInviteLoading(true);

    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Fehler beim Einladen.");
      } else {
        setTeamMembers((prev) => [...prev, data.data]);
        setTempPassword(data.tempPassword);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("BOOKKEEPER");
      }
    } catch {
      setInviteError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setInviteLoading(false);
    }
  }

  // ─── Role Update Handler ────────────────────────────────────

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/settings/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setTeamMembers((prev) =>
          prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
        );
      } else {
        alert(data.error || "Fehler beim Aendern der Rolle.");
      }
    } catch {
      alert("Ein unerwarteter Fehler ist aufgetreten.");
    }
    setEditingRoleId(null);
  }

  // ─── Delete Handler ─────────────────────────────────────────

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Moechten Sie "${name}" wirklich aus dem Team entfernen?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/team/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setTeamMembers((prev) => prev.filter((m) => m.id !== userId));
      } else {
        alert(data.error || "Fehler beim Entfernen.");
      }
    } catch {
      alert("Ein unerwarteter Fehler ist aufgetreten.");
    }
  }

  // ─── Copy Password ─────────────────────────────────────────

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Format Date ────────────────────────────────────────────

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Team
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {teamMembers.length}{" "}
            {teamMembers.length === 1 ? "Mitglied" : "Mitglieder"}
          </p>
        </div>

        {canInvite && !showInviteForm && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowInviteForm(true);
              setTempPassword("");
            }}
          >
            <UserPlus className="h-4 w-4" />
            Mitglied einladen
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div
          className={cn(
            "rounded-2xl p-5",
            "bg-[var(--glass-bg)] backdrop-blur-xl",
            "border border-[var(--glass-border)]",
            "shadow-sm"
          )}
        >
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">
            Neues Mitglied einladen
          </h3>

          {/* Temp password display */}
          {tempPassword && (
            <div className="mb-4 rounded-xl bg-amber-500/8 border border-amber-200/30 p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Temporaeres Passwort
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2 text-sm font-mono text-[var(--color-text)] select-all">
                  {tempPassword}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyPassword}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Teilen Sie diese Zugangsdaten sicher. Das Passwort wird nur
                einmal angezeigt.
              </p>
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-4">
            {inviteError && (
              <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-3 text-sm text-red-500 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {inviteError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                placeholder="Max Mustermann"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
              />
              <Input
                label="E-Mail"
                type="email"
                placeholder="max@unternehmen.de"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Rolle
              </label>
              <div className="relative">
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value as (typeof ASSIGNABLE_ROLES)[number]
                    )
                  }
                  className={cn(
                    "flex h-10 w-full rounded-xl px-3.5 py-2 text-sm appearance-none",
                    "bg-[var(--glass-bg)] backdrop-blur-xl",
                    "border border-[var(--glass-border)]",
                    "text-[var(--color-text)]",
                    "transition-all duration-200 ease-out",
                    "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                  )}
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_CONFIG[role].label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-tertiary)] pointer-events-none" />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowInviteForm(false);
                  setTempPassword("");
                  setInviteError("");
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" size="sm" disabled={inviteLoading}>
                {inviteLoading ? "Wird eingeladen..." : "Einladen"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Team Members List */}
      <div
        className={cn(
          "rounded-2xl overflow-hidden",
          "bg-[var(--glass-bg)] backdrop-blur-xl",
          "border border-[var(--glass-border)]",
          "shadow-sm"
        )}
      >
        <div className="divide-y divide-[var(--glass-border)]">
          {teamMembers.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.VIEWER;
            const RoleIcon = roleConfig.icon;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--glass-bg-hover)] transition-colors"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    roleConfig.bgColor,
                    roleConfig.color
                  )}
                >
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)] truncate">
                      {member.name}
                    </span>
                    {/* Role badge */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                        roleConfig.bgColor,
                        roleConfig.color,
                        roleConfig.borderColor
                      )}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-[var(--color-text-tertiary)] truncate">
                      {member.email}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      Seit {formatDate(member.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {canManage && member.role !== "OWNER" && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Role selector */}
                    {editingRoleId === member.id ? (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value)
                          }
                          onBlur={() => setEditingRoleId(null)}
                          autoFocus
                          className={cn(
                            "h-8 rounded-lg px-2 text-xs appearance-none pr-6",
                            "bg-[var(--glass-bg)] border border-[var(--glass-border)]",
                            "text-[var(--color-text)]",
                            "focus:outline-none focus:border-[var(--color-primary)]"
                          )}
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_CONFIG[role].label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--color-text-tertiary)] pointer-events-none" />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRoleId(member.id)}
                        className="h-8 px-2 rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        title="Rolle aendern"
                      >
                        Rolle aendern
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemove(member.id, member.name)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {teamMembers.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
              Noch keine Teammitglieder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
