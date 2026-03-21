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

        <Input
          label="Passwort"
          type="password"
          placeholder="Passwort eingeben"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-glow active:scale-[0.98] transition-all duration-200"
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
