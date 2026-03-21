"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LEGAL_FORMS = [
  { value: "EU", label: "Einzelunternehmen" },
  { value: "GmbH", label: "GmbH" },
  { value: "UG", label: "UG (haftungsbeschränkt)" },
  { value: "GbR", label: "GbR" },
  { value: "FreiBeruf", label: "Freiberufler" },
  { value: "OHG", label: "OHG" },
  { value: "KG", label: "KG" },
  { value: "AG", label: "AG" },
] as const;

type LegalFormValue = (typeof LEGAL_FORMS)[number]["value"];

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = React.useState(1);

  // Step 1 fields
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");

  // Step 2 fields
  const [organizationName, setOrganizationName] = React.useState("");
  const [legalForm, setLegalForm] = React.useState<LegalFormValue | "">("");

  // UI state
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = React.useState(false);

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};

    if (name.trim().length < 2) {
      errors.name = "Name muss mindestens 2 Zeichen lang sein.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
    }

    if (password.length < 8) {
      errors.password = "Passwort muss mindestens 8 Zeichen lang sein.";
    }

    if (password !== passwordConfirm) {
      errors.passwordConfirm = "Passwörter stimmen nicht überein.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep2(): boolean {
    const errors: Record<string, string> = {};

    if (organizationName.trim().length < 2) {
      errors.organizationName =
        "Firmenname muss mindestens 2 Zeichen lang sein.";
    }

    if (!legalForm) {
      errors.legalForm = "Bitte wählen Sie eine Rechtsform aus.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      setError("");
      setFieldErrors({});
    }
  }

  function handleBack() {
    setStep(1);
    setError("");
    setFieldErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim(),
          password,
          organizationName: organizationName.trim(),
          legalForm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("Ein Konto mit dieser E-Mail existiert bereits.");
          setStep(1);
          return;
        }
        if (res.status === 400 && data.details) {
          const errs: Record<string, string> = {};
          for (const detail of data.details) {
            errs[detail.field] = detail.message;
          }
          setFieldErrors(errs);
          return;
        }
        setError(data.error || "Registrierung fehlgeschlagen.");
        return;
      }

      // Auto-login after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Registration succeeded but login failed — redirect to login
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step === 1
                  ? "bg-primary text-white"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {step > 1 ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                "1"
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                step === 1 ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              Persönlich
            </span>
          </div>

          <div className="h-px w-8 bg-border" />

          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step === 2
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-text-muted"
              }`}
            >
              2
            </div>
            <span
              className={`text-sm font-medium ${
                step === 2 ? "text-text-primary" : "text-text-muted"
              }`}
            >
              Unternehmen
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-light border border-red-200 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-4">
            <Input
              label="Name"
              type="text"
              placeholder="Max Mustermann"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              required
              autoComplete="name"
            />

            <Input
              label="E-Mail"
              type="email"
              placeholder="name@unternehmen.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              required
              autoComplete="email"
            />

            <Input
              label="Passwort"
              type="password"
              placeholder="Mindestens 8 Zeichen"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              required
              autoComplete="new-password"
            />

            <Input
              label="Passwort bestätigen"
              type="password"
              placeholder="Passwort wiederholen"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              error={fieldErrors.passwordConfirm}
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full">
              Weiter
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Unternehmensname"
              type="text"
              placeholder="Muster GmbH"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              error={fieldErrors.organizationName}
              required
              autoComplete="organization"
            />

            <div className="space-y-1.5">
              <label
                htmlFor="legalForm"
                className="block text-sm font-medium text-text-primary"
              >
                Rechtsform
              </label>
              <select
                id="legalForm"
                value={legalForm}
                onChange={(e) =>
                  setLegalForm(e.target.value as LegalFormValue)
                }
                required
                className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Rechtsform wählen
                </option>
                {LEGAL_FORMS.map((form) => (
                  <option key={form.value} value={form.value}>
                    {form.label}
                  </option>
                ))}
              </select>
              {fieldErrors.legalForm && (
                <p className="text-sm text-danger">{fieldErrors.legalForm}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={handleBack}
                disabled={loading}
              >
                Zurück
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? "Registrieren..." : "Registrieren"}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-text-secondary">
          Bereits ein Konto?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary-hover font-medium"
          >
            Anmelden
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
