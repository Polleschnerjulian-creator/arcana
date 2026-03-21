"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  User,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface ProfileFormProps {
  user: UserData;
}

// ─── Constants ──────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Inhaber",
  ADMIN: "Administrator",
  BOOKKEEPER: "Buchhalter",
  VIEWER: "Nur Lesen",
};

const ROLE_VARIANTS: Record<string, "success" | "info" | "warning" | "default"> = {
  OWNER: "success",
  ADMIN: "info",
  BOOKKEEPER: "warning",
  VIEWER: "default",
};

// ─── Feedback Component ─────────────────────────────────────────

function FeedbackMessage({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
        type === "success"
          ? "bg-success-light text-success"
          : "bg-danger-light text-danger"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function ProfileForm({ user }: ProfileFormProps) {
  // ── Password section state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Change Password ──
  async function handleChangePassword() {
    setPasswordFeedback(null);

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Die Passwoerter stimmen nicht ueberein.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: "error",
        message: "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
      });
      return;
    }

    setPasswordSaving(true);

    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordFeedback({
          type: "error",
          message: data.error || "Fehler beim Aendern des Passworts.",
        });
        return;
      }

      setPasswordFeedback({
        type: "success",
        message: "Passwort wurde erfolgreich geaendert.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordFeedback({
        type: "error",
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Section: Benutzer ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-light">
              <User className="h-4 w-4 text-warning" />
            </div>
            <div>
              <CardTitle className="text-base">Benutzerprofil</CardTitle>
              <CardDescription>
                Benutzerinformationen und Kontodaten
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info (read-only) */}
          <div className="rounded-lg border border-border p-4 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                Benutzerprofil
              </span>
              <Badge variant={ROLE_VARIANTS[user.role] ?? "default"}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-text-muted">Name</p>
                <p className="text-sm text-text-primary">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">E-Mail</p>
                <p className="text-sm text-text-primary">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-text-primary">
              Passwort aendern
            </h4>

            <Input
              label="Aktuelles Passwort"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Neues Passwort"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Neues Passwort bestaetigen"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                error={
                  confirmPassword && newPassword !== confirmPassword
                    ? "Passwoerter stimmen nicht ueberein."
                    : undefined
                }
              />
            </div>

            {passwordFeedback && (
              <FeedbackMessage
                type={passwordFeedback.type}
                message={passwordFeedback.message}
              />
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleChangePassword}
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                <Lock className="h-4 w-4" />
                {passwordSaving
                  ? "Speichert..."
                  : "Passwort aendern"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
