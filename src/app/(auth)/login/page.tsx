"use client";

import * as React from "react";
import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const message = searchParams.get("message");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in">
      {/* Subtitle below branding */}
      <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-8">
        Willkommen zurueck
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {message === "password-reset" && (
          <div className="rounded-xl bg-green-500/8 border border-green-200/30 p-3.5 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
            Passwort erfolgreich geaendert. Bitte melden Sie sich an.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/8 border border-red-200/30 p-3.5 text-sm text-red-500 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </div>
        )}

        <Input
          label="E-Mail"
          type="email"
          placeholder="name@unternehmen.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
          <Input
            label="Passwort"
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="mt-1.5 text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              Passwort vergessen?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#1D1D1F] text-white hover:bg-black hover:shadow-glow active:scale-[0.98] transition-all duration-200"
          disabled={loading}
        >
          {loading ? "Anmelden..." : "Anmelden"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Noch kein Konto?{" "}
        <Link
          href="/register"
          className="text-primary hover:text-primary-dark font-medium transition-colors"
        >
          Registrieren
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
