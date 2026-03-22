"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Kein Reset-Token vorhanden.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Die Passwoerter stimmen nicht ueberein.");
      return;
    }

    if (password.length < 12) {
      setError("Passwort muss mindestens 12 Zeichen lang sein.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
      } else {
        // Redirect to login with success message
        router.push("/login?message=password-reset");
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="animate-in">
        <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-8">
          Passwort zuruecksetzen
        </p>

        <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-4 text-sm text-red-500 mb-6">
          <p>
            Ungueltiger oder fehlender Reset-Link. Bitte fordern Sie einen
            neuen Link an.
          </p>
        </div>

        <div className="text-center text-sm text-[var(--color-text-secondary)]">
          <Link
            href="/forgot-password"
            className="text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-8">
        Neues Passwort festlegen
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-3.5 text-sm text-red-500 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </div>
        )}

        <Input
          label="Neues Passwort"
          type="password"
          placeholder="Mindestens 12 Zeichen"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Input
          label="Passwort bestaetigen"
          type="password"
          placeholder="Passwort wiederholen"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Button
          type="submit"
          className="w-full bg-[#1D1D1F] text-white hover:bg-black hover:shadow-glow active:scale-[0.98] transition-all duration-200"
          disabled={loading}
        >
          {loading ? "Wird gespeichert..." : "Passwort zuruecksetzen"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        <Link
          href="/login"
          className="text-primary hover:text-primary-dark font-medium transition-colors"
        >
          Zurueck zur Anmeldung
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
