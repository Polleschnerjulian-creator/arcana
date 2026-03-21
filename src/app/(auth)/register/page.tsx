"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const LEGAL_FORMS = [
  { value: "EU", label: "Einzelunternehmen" },
  { value: "GmbH", label: "GmbH" },
  { value: "UG", label: "UG (haftungsbeschraenkt)" },
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
      errors.email = "Bitte geben Sie eine gueltige E-Mail-Adresse ein.";
    }

    if (password.length < 8) {
      errors.password = "Passwort muss mindestens 8 Zeichen lang sein.";
    }

    if (password !== passwordConfirm) {
      errors.passwordConfirm = "Passwoerter stimmen nicht ueberein.";
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
      errors.legalForm = "Bitte waehlen Sie eine Rechtsform aus.";
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
    <div className="animate-in">
      {/* Subtitle below branding */}
      <p className="text-center text-sm text-[var(--color-text-secondary)] -mt-4 mb-6">
        Konto erstellen
      </p>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {/* Step 1 */}
        <div className="flex flex-col items-center">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
              step === 1
                ? "bg-primary/15 text-primary shadow-glow"
                : "bg-primary text-white"
            }`}
          >
            {step > 1 ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <span
            className={`text-xs mt-1.5 font-medium transition-colors ${
              step === 1 ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
            }`}
          >
            Persoenlich
          </span>
        </div>

        {/* Connecting line */}
        <div className="relative w-16 h-px mx-2 mb-5">
          <div className="absolute inset-0 bg-gray-200 rounded-full" />
          <div
            className={`absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500 ease-out ${
              step > 1 ? "w-full" : "w-0"
            }`}
          />
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
              step === 2
                ? "bg-primary/15 text-primary shadow-glow"
                : "bg-gray-100 text-[var(--color-text-tertiary)]"
            }`}
          >
            2
          </div>
          <span
            className={`text-xs mt-1.5 font-medium transition-colors ${
              step === 2 ? "text-[var(--color-text)]" : "text-[var(--color-text-tertiary)]"
            }`}
          >
            Unternehmen
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-500/8 border border-red-200/30 p-3.5 text-sm text-red-500 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step Content with transition */}
      <div className="relative overflow-hidden">
        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-5 animate-in" key="step1">
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
              label="Passwort bestaetigen"
              type="password"
              placeholder="Passwort wiederholen"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              error={fieldErrors.passwordConfirm}
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-glow active:scale-[0.98] transition-all duration-200"
            >
              Weiter
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 animate-in" key="step2">
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
                className="block text-sm font-medium text-[var(--color-text)]"
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
                className="flex h-10 w-full rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 px-3 py-2 text-sm text-[var(--color-text)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Rechtsform waehlen
                </option>
                {LEGAL_FORMS.map((form) => (
                  <option key={form.value} value={form.value}>
                    {form.label}
                  </option>
                ))}
              </select>
              {fieldErrors.legalForm && (
                <p className="text-sm text-red-500">{fieldErrors.legalForm}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 bg-white/40 backdrop-blur-sm border-white/50 hover:bg-white/60 active:scale-[0.98] transition-all duration-200"
                onClick={handleBack}
                disabled={loading}
              >
                Zurueck
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-glow active:scale-[0.98] transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Registrieren..." : "Registrieren"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Bereits ein Konto?{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary-dark font-medium transition-colors"
        >
          Anmelden
        </Link>
      </div>
    </div>
  );
}
