"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="animate-in">
        <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-8">
          Passwort zuruecksetzen
        </p>

        <div className="rounded-xl bg-green-500/8 border border-green-200/30 p-4 text-sm text-green-700 dark:text-green-400 mb-6">
          <p className="font-medium mb-1">E-Mail gesendet</p>
          <p>
            Pruefen Sie Ihr Postfach. Falls ein Konto mit dieser E-Mail
            existiert, erhalten Sie einen Link zum Zuruecksetzen.
          </p>
        </div>

        <div className="text-center text-sm text-[var(--color-text-secondary)]">
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

  return (
    <div className="animate-in">
      <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-8">
        Passwort zuruecksetzen
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-3.5 text-sm text-red-500 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </div>
        )}

        <p className="text-sm text-[var(--color-text-secondary)]">
          Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link
          zum Zuruecksetzen Ihres Passworts.
        </p>

        <Input
          label="E-Mail"
          type="email"
          placeholder="name@unternehmen.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Button
          type="submit"
          className="w-full bg-[#1D1D1F] text-white hover:bg-black hover:shadow-glow active:scale-[0.98] transition-all duration-200"
          disabled={loading}
        >
          {loading ? "Wird gesendet..." : "Link senden"}
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
