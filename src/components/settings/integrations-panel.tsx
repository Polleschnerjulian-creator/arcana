"use client";

import { useState, useCallback } from "react";
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
import { cn, formatDate } from "@/lib/utils";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  FileText,
  ArrowUpDown,
  Receipt,
  Webhook,
  Loader2,
  Info,
  ExternalLink,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string;
  lastUsed: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface WebhookLog {
  id: string;
  source: string;
  event: string;
  status: "RECEIVED" | "PROCESSED" | "FAILED";
  payload: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

interface IntegrationsPanelProps {
  initialApiKeys: ApiKey[];
  initialWebhookLogs: WebhookLog[];
}

// ── Permission Labels ────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  webhook: "Webhook",
  read: "Lesezugriff",
  full: "Vollzugriff",
};

const PERMISSION_VARIANTS: Record<string, "default" | "info" | "success"> = {
  webhook: "default",
  read: "info",
  full: "success",
};

// ── Status Config ────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "warning" | "success" | "danger" }
> = {
  RECEIVED: { label: "Empfangen", variant: "warning" },
  PROCESSED: { label: "Verarbeitet", variant: "success" },
  FAILED: { label: "Fehlgeschlagen", variant: "danger" },
};

// ── Webhook Events ───────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  {
    event: "invoice.created",
    description: "Rechnung automatisch erstellen",
    icon: Receipt,
    payload: {
      event: "invoice.created",
      timestamp: "2026-03-21T10:30:00Z",
      data: {
        invoiceNumber: "RE-2026-0042",
        customerName: "Mustermann GmbH",
        amount: 1190.0,
        currency: "EUR",
        taxRate: 19,
        netAmount: 1000.0,
        dueDate: "2026-04-20",
        items: [
          {
            description: "Beratungsleistung",
            quantity: 10,
            unitPrice: 100.0,
            total: 1000.0,
          },
        ],
      },
    },
  },
  {
    event: "document.uploaded",
    description: "Beleg aus externer Quelle importieren",
    icon: FileText,
    payload: {
      event: "document.uploaded",
      timestamp: "2026-03-21T14:15:00Z",
      data: {
        fileName: "rechnung-2026-03.pdf",
        mimeType: "application/pdf",
        fileUrl: "https://example.com/files/rechnung-2026-03.pdf",
        source: "zapier",
        metadata: {
          vendor: "Office Supplies GmbH",
          category: "Bueroausstattung",
        },
      },
    },
  },
  {
    event: "transaction.created",
    description: "Buchung automatisch anlegen",
    icon: ArrowUpDown,
    payload: {
      event: "transaction.created",
      timestamp: "2026-03-21T09:00:00Z",
      data: {
        date: "2026-03-21",
        description: "Monatliche Bueromiete",
        amount: 1500.0,
        currency: "EUR",
        debitAccount: "4210",
        creditAccount: "1200",
        taxRate: 19,
        reference: "MIETE-2026-03",
      },
    },
  },
];

// ── Copy Button Component ────────────────────────────────────────

function CopyButton({
  text,
  className,
  size = "sm",
}: {
  text: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg transition-all duration-200",
        "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
        "hover:bg-black/[0.04] active:scale-95",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className
      )}
      title="In Zwischenablage kopieren"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-emerald-500">Kopiert</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Kopieren</span>
        </>
      )}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function IntegrationsPanel({
  initialApiKeys,
  initialWebhookLogs,
}: IntegrationsPanelProps) {
  // ── API Keys state ──
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermission, setNewKeyPermission] = useState("webhook");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // ── Webhook logs state ──
  const [webhookLogs, setWebhookLogs] =
    useState<WebhookLog[]>(initialWebhookLogs);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedEventIdx, setExpandedEventIdx] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLogsLoaded, setAllLogsLoaded] = useState(
    initialWebhookLogs.length < 10
  );

  // ── Webhook URL ──
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/webhook`
      : "https://arcana-julians-projects-a288745c.vercel.app/api/v1/webhook";

  // ── Create API key ──
  async function handleCreateKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    setKeyError(null);
    setCreatedKey(null);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPermission,
          expiresAt: newKeyExpiry || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setKeyError(data.error || "Fehler beim Erstellen des Schluessels.");
        return;
      }

      setCreatedKey(data.fullKey);
      setApiKeys((prev) => [data.apiKey, ...prev]);
      setNewKeyName("");
      setNewKeyPermission("webhook");
      setNewKeyExpiry("");
      setShowCreateForm(false);
    } catch {
      setKeyError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setCreating(false);
    }
  }

  // ── Revoke API key ──
  async function handleRevokeKey(id: string) {
    setRevokingId(id);

    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setKeyError(data.error || "Fehler beim Widerrufen.");
        return;
      }

      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setKeyError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRevokingId(null);
    }
  }

  // ── Load more logs ──
  async function handleLoadMore() {
    setLoadingMore(true);

    try {
      const offset = webhookLogs.length;
      const res = await fetch(
        `/api/v1/webhook/logs?offset=${offset}&limit=10`
      );
      const data = await res.json();

      if (!res.ok) return;

      const newLogs = data.logs || [];
      setWebhookLogs((prev) => [...prev, ...newLogs]);
      if (newLogs.length < 10) {
        setAllLogsLoaded(true);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 1: API-Schluessel                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.06]">
                <Key
                  className="h-4 w-4 text-[var(--color-text)]"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <CardTitle className="text-base">API-Schluessel</CardTitle>
                <CardDescription>
                  Verwalten Sie Ihre API-Schluessel fuer externe Integrationen
                </CardDescription>
              </div>
            </div>
            {!showCreateForm && !createdKey && (
              <Button
                size="sm"
                onClick={() => {
                  setShowCreateForm(true);
                  setCreatedKey(null);
                  setKeyError(null);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Neuen Schluessel erstellen</span>
                <span className="sm:hidden">Neu</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Created Key Reveal ── */}
          {createdKey && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Dieser Schluessel wird nur einmal angezeigt. Bitte kopieren und
                  sicher aufbewahren.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-black/[0.04] border border-black/[0.06] px-3 py-2.5">
                <code className="flex-1 text-sm font-mono text-[var(--color-text)] break-all select-all">
                  {createdKey}
                </code>
                <CopyButton text={createdKey} size="md" />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatedKey(null)}
                >
                  Verstanden
                </Button>
              </div>
            </div>
          )}

          {/* ── Create Form ── */}
          {showCreateForm && (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4 space-y-4">
              <h4 className="text-sm font-medium text-[var(--color-text)]">
                Neuen API-Schluessel erstellen
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Name"
                  placeholder="z.B. Zapier Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    Berechtigungen
                  </label>
                  <select
                    className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                    value={newKeyPermission}
                    onChange={(e) => setNewKeyPermission(e.target.value)}
                  >
                    <option value="webhook">Webhook</option>
                    <option value="read">Lesezugriff</option>
                    <option value="full">Vollzugriff</option>
                  </select>
                </div>
                <Input
                  label="Ablaufdatum (optional)"
                  type="date"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                />
              </div>

              {keyError && (
                <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {keyError}
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setKeyError(null);
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyName.trim()}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Erstellt...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Erstellen
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── API Keys List ── */}
          {apiKeys.length === 0 && !showCreateForm && !createdKey ? (
            <div className="text-center py-8">
              <Key
                className="h-8 w-8 mx-auto text-[var(--color-text-tertiary)] mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Noch keine API-Schluessel erstellt
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Erstellen Sie einen Schluessel, um externe Dienste zu verbinden
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm px-4 py-3 transition-all duration-200 hover:bg-[var(--glass-bg-hover)]"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--color-text)] truncate">
                        {key.name}
                      </span>
                      <Badge
                        variant={
                          PERMISSION_VARIANTS[key.permissions] || "default"
                        }
                      >
                        {PERMISSION_LABELS[key.permissions] || key.permissions}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                      <code className="font-mono bg-black/[0.04] rounded px-1.5 py-0.5">
                        {key.prefix}...
                      </code>
                      <span>
                        Erstellt: {formatDate(key.createdAt)}
                      </span>
                      {key.lastUsed && (
                        <span>
                          Letzter Zugriff: {formatDate(key.lastUsed)}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span>
                          Laeuft ab: {formatDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRevokeKey(key.id)}
                    disabled={revokingId === key.id}
                  >
                    {revokingId === key.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Widerrufen</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 2: Webhook-Endpunkt                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.06]">
              <Globe
                className="h-4 w-4 text-[var(--color-text)]"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <CardTitle className="text-base">Webhook-Endpunkt</CardTitle>
              <CardDescription>
                Senden Sie Events an diesen Endpunkt, um Daten automatisch zu
                importieren
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Webhook-URL
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-black/[0.03] backdrop-blur-xl px-4 py-3">
              <code className="flex-1 text-sm font-mono text-[var(--color-text)] break-all select-all">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} size="md" />
            </div>
            <div className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Authentifizieren Sie Ihre Anfragen mit dem Header{" "}
                <code className="font-mono bg-black/[0.04] rounded px-1 py-0.5">
                  Authorization: Bearer arc_...
                </code>
              </span>
            </div>
          </div>

          {/* Supported Events */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--color-text)]">
              Unterstuetzte Events
            </h4>
            <div className="space-y-2">
              {WEBHOOK_EVENTS.map((ev, idx) => {
                const Icon = ev.icon;
                const isExpanded = expandedEventIdx === idx;

                return (
                  <div
                    key={ev.event}
                    className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() =>
                        setExpandedEventIdx(isExpanded ? null : idx)
                      }
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors duration-200"
                    >
                      <Icon
                        className="h-4 w-4 text-[var(--color-text-secondary)] shrink-0"
                        strokeWidth={1.5}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium text-[var(--color-text)]">
                            {ev.event}
                          </code>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {ev.description}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)] shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[var(--glass-border)] px-4 py-3 bg-black/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            Beispiel-Payload
                          </span>
                          <CopyButton
                            text={JSON.stringify(ev.payload, null, 2)}
                          />
                        </div>
                        <pre className="text-xs font-mono text-[var(--color-text-secondary)] bg-black/[0.04] rounded-lg p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 3: Webhook-Protokoll                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.06]">
              <Webhook
                className="h-4 w-4 text-[var(--color-text)]"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <CardTitle className="text-base">Webhook-Protokoll</CardTitle>
              <CardDescription>
                Letzte eingehende Webhook-Anfragen und deren Status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <div className="text-center py-10">
              <Webhook
                className="h-8 w-8 mx-auto text-[var(--color-text-tertiary)] mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Noch keine Webhooks empfangen
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Eingehende Webhook-Anfragen werden hier protokolliert
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {webhookLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const statusCfg = STATUS_CONFIG[log.status] || {
                  label: log.status,
                  variant: "default" as const,
                };

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() =>
                        setExpandedLogId(isExpanded ? null : log.id)
                      }
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors duration-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono text-[var(--color-text)]">
                            {log.event}
                          </code>
                          <Badge variant={statusCfg.variant}>
                            {statusCfg.label}
                          </Badge>
                          <Badge variant="default">{log.source}</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                          {new Intl.DateTimeFormat("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          }).format(new Date(log.createdAt))}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)] shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[var(--glass-border)] px-4 py-3 bg-black/[0.02] space-y-3">
                        {log.error && (
                          <div className="flex items-start gap-2 rounded-lg bg-red-500/[0.06] border border-red-500/10 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-500">{log.error}</p>
                          </div>
                        )}
                        {log.payload && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                Payload
                              </span>
                              <CopyButton
                                text={JSON.stringify(log.payload, null, 2)}
                              />
                            </div>
                            <pre className="text-xs font-mono text-[var(--color-text-secondary)] bg-black/[0.04] rounded-lg p-3 overflow-x-auto max-h-64">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {!log.payload && !log.error && (
                          <p className="text-sm text-[var(--color-text-tertiary)]">
                            Keine weiteren Details verfuegbar.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more */}
              {!allLogsLoaded && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Laden...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        Alle anzeigen
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
