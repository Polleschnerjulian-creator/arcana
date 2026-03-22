"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  Check,
  Loader2,
  Inbox,
  ArrowLeftRight,
  Receipt,
  Sparkles,
  Building2,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface OrgFields {
  street: string;
  city: string;
  zip: string;
  taxId: string;
  ustId: string;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgFields, setOrgFields] = useState<OrgFields>({
    street: "",
    city: "",
    zip: "",
    taxId: "",
    ustId: "",
  });
  const [orgLoading, setOrgLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [autoDismiss, setAutoDismiss] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current org data on mount
  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.organization) {
            const org = data.data.organization;
            setOrgFields({
              street: org.street || "",
              city: org.city || "",
              zip: org.zip || "",
              taxId: org.taxId || "",
              ustId: org.ustId || "",
            });
          }
        }
      } catch {
        // ignore — user can fill in manually
      } finally {
        setOrgLoading(false);
      }
    }
    loadOrg();
  }, []);

  // Auto-dismiss on final step
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        onComplete();
      }, 5000);
      setAutoDismiss(timer);
      return () => clearTimeout(timer);
    }
    return () => {
      if (autoDismiss) clearTimeout(autoDismiss);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const saveOrgFields = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: orgFields.street || null,
          city: orgFields.city || null,
          zip: orgFields.zip || null,
          taxId: orgFields.taxId || null,
          ustId: orgFields.ustId || null,
        }),
      });
    } catch {
      // silent — non-critical
    } finally {
      setSaving(false);
      setStep(2);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      setUploadFile(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("type", "INCOMING_INVOICE");

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadDone(true);
        // Trigger pipeline
        if (data.data?.processUrl) {
          fetch(data.data.processUrl, { method: "POST" }).catch(() => {});
        }
        setTimeout(() => setStep(3), 800);
      }
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const progressWidth = `${((step + 1) / 4) * 100}%`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md" />

      {/* Container */}
      <div className="relative w-full max-w-lg mx-4 animate-in">
        {/* Glass card */}
        <div className="glass-strong rounded-3xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-black/[0.04] dark:bg-white/[0.04]">
            <div
              className="h-full bg-[var(--color-text)] transition-all duration-500 ease-out rounded-full"
              style={{ width: progressWidth }}
            />
          </div>

          {/* Close button */}
          {step < 3 && (
            <button
              onClick={onComplete}
              className="absolute top-4 right-4 p-2 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all z-10"
              title="Schliessen"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="p-8">
            {/* ── Step 0: Willkommen ── */}
            {step === 0 && (
              <div className="text-center space-y-6 animate-in">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center shadow-lg">
                      <span className="text-3xl font-bold text-white dark:text-black tracking-tighter">A</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--color-success)] flex items-center justify-center shadow-md">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                    Willkommen bei ARCANA!
                  </h2>
                  <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed max-w-sm mx-auto">
                    In 3 Schritten ist Ihre Buchhaltung eingerichtet. Es dauert weniger als 2 Minuten.
                  </p>
                </div>

                {/* Step indicators */}
                <div className="flex justify-center gap-6 py-2">
                  {[
                    { icon: Building2, label: "Firmendaten" },
                    { icon: Upload, label: "Erster Beleg" },
                    { icon: Check, label: "Fertig" },
                  ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
                          <Icon className="h-4.5 w-4.5 text-[var(--color-text-secondary)]" />
                        </div>
                        <span className="text-xs text-[var(--color-text-tertiary)]">{s.label}</span>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={() => setStep(1)}
                  size="lg"
                  className="w-full"
                >
                  Los geht&apos;s
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* ── Step 1: Firmendaten ── */}
            {step === 1 && (
              <div className="space-y-6 animate-in">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
                      <Building2 className="h-3.5 w-3.5 text-white dark:text-black" />
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      Firmendaten vervollst&auml;ndigen
                    </h2>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Diese Daten erscheinen auf Ihren Rechnungen und Berichten.
                  </p>
                </div>

                {orgLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      label="Strasse & Hausnummer"
                      value={orgFields.street}
                      onChange={(e) => setOrgFields((f) => ({ ...f, street: e.target.value }))}
                      placeholder="Musterstrasse 42"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        label="PLZ"
                        value={orgFields.zip}
                        onChange={(e) => setOrgFields((f) => ({ ...f, zip: e.target.value }))}
                        placeholder="10115"
                      />
                      <div className="col-span-2">
                        <Input
                          label="Stadt"
                          value={orgFields.city}
                          onChange={(e) => setOrgFields((f) => ({ ...f, city: e.target.value }))}
                          placeholder="Berlin"
                        />
                      </div>
                    </div>
                    <Input
                      label="Steuernummer"
                      value={orgFields.taxId}
                      onChange={(e) => setOrgFields((f) => ({ ...f, taxId: e.target.value }))}
                      placeholder="12/345/67890"
                    />
                    <Input
                      label="USt-IdNr."
                      value={orgFields.ustId}
                      onChange={(e) => setOrgFields((f) => ({ ...f, ustId: e.target.value }))}
                      placeholder="DE123456789"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(0)} size="md">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    &Uuml;berspringen
                  </Button>
                  <Button
                    onClick={saveOrgFields}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Weiter
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Beleg hochladen ── */}
            {step === 2 && (
              <div className="space-y-6 animate-in">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
                      <Upload className="h-3.5 w-3.5 text-white dark:text-black" />
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      Ersten Beleg hochladen
                    </h2>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Laden Sie Ihre erste Rechnung hoch — ARCANA erkennt alles automatisch.
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragging
                      ? "border-[var(--color-text)] bg-black/[0.04] dark:bg-white/[0.06] scale-[1.02]"
                      : "border-[var(--glass-border)] hover:border-[var(--color-text-tertiary)] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    }
                    ${uploadDone ? "border-[var(--color-success)] bg-emerald-500/5" : ""}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                      e.target.value = "";
                    }}
                  />

                  {uploadDone ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                        <Check className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Hochgeladen! ARCANA verarbeitet den Beleg...
                      </p>
                    </div>
                  ) : uploadFile ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mx-auto">
                        <FileText className="h-6 w-6 text-[var(--color-text-secondary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)] truncate max-w-[280px] mx-auto">
                          {uploadFile.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {(uploadFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mx-auto">
                        <Upload className="h-6 w-6 text-[var(--color-text-secondary)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        Datei hierher ziehen oder klicken
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        PDF, JPG, PNG — max. 10 MB
                      </p>
                    </div>
                  )}
                </div>

                {uploadFile && !uploadDone && (
                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Wird hochgeladen...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Hochladen
                      </>
                    )}
                  </Button>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)} size="md">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    &Uuml;berspringen
                  </Button>
                  {!uploadFile && (
                    <Button
                      onClick={() => setStep(3)}
                      className="flex-1"
                    >
                      Fertig
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Fertig! ── */}
            {step === 3 && (
              <div className="text-center space-y-6 animate-in">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="h-8 w-8 text-emerald-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                    Alles eingerichtet!
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mx-auto">
                    ARCANA ist bereit. W&auml;hlen Sie, womit Sie beginnen m&ouml;chten.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Inbox, label: "Eingangskorb", href: "/inbox" },
                    { icon: ArrowLeftRight, label: "Neue Buchung", href: "/transactions/new" },
                    { icon: Receipt, label: "Rechnung erstellen", href: "/invoices/new" },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.href}
                        onClick={() => {
                          onComplete();
                          router.push(action.href);
                        }}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all duration-200 group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center group-hover:shadow-md transition-shadow">
                          <Icon className="h-4.5 w-4.5 text-white dark:text-black" />
                        </div>
                        <span className="text-xs font-medium text-[var(--color-text)]">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="secondary"
                  onClick={onComplete}
                  className="w-full"
                >
                  Zum Dashboard
                </Button>

                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Schliesst automatisch in wenigen Sekunden...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
