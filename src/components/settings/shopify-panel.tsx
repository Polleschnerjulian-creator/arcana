"use client";

import { useState, useCallback, useEffect } from "react";
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  ShoppingBag,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Loader2,
  Info,
  Link2,
  Settings,
  Unplug,
  Pencil,
  ExternalLink,
  ClipboardList,
  Zap,
  ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface ShopifyConnection {
  id: string;
  shopDomain: string;
  defaultTaxRate: number;
  isActive: boolean;
  ordersProcessed: number;
  lastOrderAt: string | null;
  createdAt: string;
}

interface ShopifyOrder {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
  invoiceId: string | null;
  transactionId: string | null;
  status: "PROCESSED" | "REFUNDED" | "PARTIAL_REFUND";
  orderTotal: string | number;
  currency: string;
  processedAt: string;
}

interface ShopifyPanelProps {
  initialConnection: ShopifyConnection | null;
  initialOrders: ShopifyOrder[];
}

// ── Status Config ────────────────────────────────────────────────

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "danger" | "warning" }
> = {
  PROCESSED: { label: "Verarbeitet", variant: "success" },
  REFUNDED: { label: "Erstattet", variant: "danger" },
  PARTIAL_REFUND: { label: "Teilerstattet", variant: "warning" },
};

// ── Copy Button Component ────────────────────────────────────────

function CopyButton({
  text,
  className,
  size = "sm",
  label,
}: {
  text: string;
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
          <span className="text-emerald-500">{label || "Kopiert"}</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label || "Kopieren"}</span>
        </>
      )}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function ShopifyPanel({
  initialConnection,
  initialOrders,
}: ShopifyPanelProps) {
  // ── Connection state ──
  const [connection, setConnection] = useState<ShopifyConnection | null>(
    initialConnection
  );
  const [orders, setOrders] = useState<ShopifyOrder[]>(initialOrders);

  // ── Setup wizard / edit state ──
  const [shopDomain, setShopDomain] = useState(
    initialConnection?.shopDomain || ""
  );
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState(
    initialConnection?.defaultTaxRate?.toString() || "19"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // ── Webhook URL (client-side) ──
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/v1/integrations/shopify`);
  }, []);

  // ── Save connection ──
  async function handleSave() {
    if (!shopDomain.trim()) {
      setError("Bitte geben Sie die Shop-Domain ein.");
      return;
    }
    if (!connection && !webhookSecret.trim()) {
      setError("Bitte geben Sie das Webhook-Secret ein.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
          defaultTaxRate: parseFloat(defaultTaxRate),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Speichern der Verbindung.");
        return;
      }

      setConnection(data.connection);
      setWebhookSecret("");
      setEditing(false);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  // ── Disconnect ──
  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/shopify", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Trennen der Verbindung.");
        return;
      }

      setConnection(null);
      setShopDomain("");
      setWebhookSecret("");
      setDefaultTaxRate("19");
      setOrders([]);
      setShowDisconnectConfirm(false);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Toggle edit mode ──
  function handleStartEdit() {
    setShopDomain(connection?.shopDomain || "");
    setDefaultTaxRate(connection?.defaultTaxRate?.toString() || "19");
    setWebhookSecret("");
    setEditing(true);
    setError(null);
  }

  const isConnected = connection?.isActive;

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 1: Verbindung                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#96BF48]/10 border border-[#96BF48]/20">
                <ShoppingBag
                  className="h-5 w-5 text-[#96BF48]"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <CardTitle className="text-base">
                  {isConnected ? "Shopify-Verbindung" : "Shopify verbinden"}
                </CardTitle>
                <CardDescription>
                  {isConnected
                    ? "Ihr Shopify-Shop ist verbunden"
                    : "Verbinden Sie Ihren Shopify-Shop fuer automatische Rechnungen"}
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="success">Verbunden</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Connected View ── */}
          {isConnected && !editing ? (
            <div className="space-y-5">
              {/* Connection details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Shop
                  </span>
                  <p className="text-sm font-mono text-[var(--color-text)] bg-black/[0.03] rounded-lg px-3 py-2 border border-black/[0.06]">
                    {connection.shopDomain}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Steuersatz
                  </span>
                  <p className="text-sm text-[var(--color-text)] bg-black/[0.03] rounded-lg px-3 py-2 border border-black/[0.06]">
                    {connection.defaultTaxRate}%
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Verarbeitete Bestellungen
                  </span>
                  <p className="text-sm text-[var(--color-text)] bg-black/[0.03] rounded-lg px-3 py-2 border border-black/[0.06]">
                    {connection.ordersProcessed}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Letzte Bestellung
                  </span>
                  <p className="text-sm text-[var(--color-text)] bg-black/[0.03] rounded-lg px-3 py-2 border border-black/[0.06]">
                    {connection.lastOrderAt
                      ? formatDate(connection.lastOrderAt)
                      : "Noch keine"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartEdit}
                >
                  <Pencil className="h-4 w-4" />
                  Verbindung bearbeiten
                </Button>
                {showDisconnectConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Wirklich trennen?
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                    >
                      {disconnecting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Trennt...
                        </>
                      ) : (
                        "Ja, trennen"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDisconnectConfirm(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(true)}
                  >
                    <Unplug className="h-4 w-4" />
                    Verbindung trennen
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {/* ── Edit mode ── */}
          {isConnected && editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Shop-Domain"
                  placeholder="mein-shop.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                />
                <Input
                  label="Webhook-Secret (nur bei Aenderung)"
                  placeholder="Leer lassen um beizubehalten"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
              </div>
              <div className="max-w-xs">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                    Standard-Steuersatz
                  </label>
                  <select
                    className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                  >
                    <option value="19">19% (Regelsteuersatz)</option>
                    <option value="7">7% (Ermaessigt)</option>
                    <option value="0">0% (Steuerfrei)</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !shopDomain.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Speichert...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {/* ── Setup Wizard (not connected) ── */}
          {!isConnected ? (
            <div className="space-y-6">
              {/* Introduction */}
              <div className="flex items-start gap-3 rounded-xl border border-sky-500/15 bg-sky-500/[0.04] backdrop-blur-xl p-4">
                <Info className="h-5 w-5 text-sky-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    Automatische Rechnungserstellung
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Wenn ein Kunde in Ihrem Shopify-Shop bestellt, erstellt ARCANA
                    automatisch eine Rechnung und die zugehoerige Buchung. Folgen Sie
                    den Schritten unten, um die Verbindung einzurichten.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D1D1F] text-white text-xs font-semibold">
                    1
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Shopify Admin oeffnen
                  </h4>
                </div>
                <div className="ml-10 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm p-4 space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Oeffnen Sie Ihren Shopify-Admin und navigieren Sie zu:
                  </p>
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                    <Settings className="h-4 w-4 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
                    <span className="font-medium">Einstellungen</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                    <span className="font-medium">Benachrichtigungen</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                    <span className="font-medium">Webhooks</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D1D1F] text-white text-xs font-semibold">
                    2
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Webhooks erstellen
                  </h4>
                </div>
                <div className="ml-10 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm p-4 space-y-4">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Klicken Sie auf &quot;Webhook erstellen&quot; und konfigurieren Sie:
                  </p>

                  {/* Webhook config table */}
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[var(--glass-border)] bg-black/[0.02] overflow-hidden">
                      <div className="grid grid-cols-[auto_1fr] divide-y divide-[var(--glass-border)]">
                        <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)] bg-black/[0.03] border-r border-[var(--glass-border)]">
                          Event
                        </div>
                        <div className="px-3 py-2 text-sm text-[var(--color-text)]">
                          Bestellung bezahlt <code className="text-xs font-mono bg-black/[0.04] rounded px-1.5 py-0.5 ml-1">(orders/paid)</code>
                        </div>
                        <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)] bg-black/[0.03] border-r border-[var(--glass-border)]">
                          Format
                        </div>
                        <div className="px-3 py-2 text-sm text-[var(--color-text)]">
                          JSON
                        </div>
                        <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)] bg-black/[0.03] border-r border-[var(--glass-border)]">
                          URL
                        </div>
                        <div className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-[var(--color-text)] bg-black/[0.04] rounded px-2 py-1 break-all select-all">
                              {webhookUrl || "Wird geladen..."}
                            </code>
                            {webhookUrl && <CopyButton text={webhookUrl} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Wiederholen Sie diesen Schritt fuer das Event{" "}
                      <code className="font-mono text-xs bg-black/[0.04] rounded px-1 py-0.5">
                        Rueckerstattung erstellt (refunds/create)
                      </code>{" "}
                      mit derselben URL.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D1D1F] text-white text-xs font-semibold">
                    3
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    Verbindung einrichten
                  </h4>
                </div>
                <div className="ml-10 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm p-4 space-y-4">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Geben Sie Ihre Shop-Daten ein. Das Webhook-Secret finden Sie auf
                    derselben Seite in Shopify unter den Webhook-Einstellungen.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Shop-Domain"
                      placeholder="mein-shop.myshopify.com"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                    />
                    <Input
                      label="Webhook-Secret"
                      placeholder="whsec_..."
                      type="password"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                    />
                  </div>

                  <div className="max-w-xs">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                        Standard-Steuersatz
                      </label>
                      <select
                        className="flex h-10 w-full rounded-xl px-3.5 py-2 text-sm bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-inner text-[var(--color-text)] transition-all duration-200 ease-out focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-glow)]"
                        value={defaultTaxRate}
                        onChange={(e) => setDefaultTaxRate(e.target.value)}
                      >
                        <option value="19">19% (Regelsteuersatz)</option>
                        <option value="7">7% (Ermaessigt)</option>
                        <option value="0">0% (Steuerfrei)</option>
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-500/10 text-red-500">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSave}
                      disabled={saving || !shopDomain.trim() || !webhookSecret.trim()}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verbindet...
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4" />
                          Verbindung speichern
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 2: Webhook-URL                                     */}
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
              <CardTitle className="text-base">Webhook-URL</CardTitle>
              <CardDescription>
                Diese URL in Shopify unter Einstellungen einfuegen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL box */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Ihre Webhook-URL
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-black/[0.03] backdrop-blur-xl px-4 py-3.5">
              <code className="flex-1 text-sm font-mono text-[var(--color-text)] break-all select-all">
                {webhookUrl || "Wird geladen..."}
              </code>
              {webhookUrl && <CopyButton text={webhookUrl} size="md" label="URL kopieren" />}
            </div>
            <div className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Fuegen Sie diese URL in Shopify unter{" "}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  Einstellungen &rarr; Benachrichtigungen &rarr; Webhooks
                </span>{" "}
                ein.
              </span>
            </div>
          </div>

          {/* Supported events */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--color-text)]">
              Unterstuetzte Events
            </h4>
            <div className="space-y-2">
              {/* orders/paid */}
              <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm px-4 py-3 transition-all duration-200 hover:bg-black/[0.02]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Zap className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-medium text-[var(--color-text)]">
                      orders/paid
                    </code>
                    <Badge variant="success">Aktiv</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Rechnung + Buchung automatisch erstellen
                  </p>
                </div>
              </div>

              {/* refunds/create */}
              <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 backdrop-blur-sm px-4 py-3 transition-all duration-200 hover:bg-black/[0.02]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <Zap className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-medium text-[var(--color-text)]">
                      refunds/create
                    </code>
                    <Badge variant="danger">Aktiv</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Stornobuchung automatisch erstellen
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 3: Bestellungsprotokoll                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.06]">
              <ClipboardList
                className="h-4 w-4 text-[var(--color-text)]"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <CardTitle className="text-base">Bestellungsprotokoll</CardTitle>
              <CardDescription>
                Letzte verarbeitete Shopify-Bestellungen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag
                className="h-8 w-8 mx-auto text-[var(--color-text-tertiary)] mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Noch keine Bestellungen verarbeitet
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Bestellungen erscheinen hier, sobald Webhooks von Shopify eingehen
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--glass-border)]">
                <span>Bestellnr.</span>
                <span className="w-24 text-right">Betrag</span>
                <span className="w-28 text-center">Status</span>
                <span className="w-28">Rechnungsnr.</span>
                <span className="w-24 text-right">Datum</span>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-[var(--glass-border)]">
                {orders.map((order) => {
                  const statusCfg = ORDER_STATUS_CONFIG[order.status] || {
                    label: order.status,
                    variant: "default" as const,
                  };

                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 text-sm hover:bg-black/[0.02] transition-colors duration-200"
                    >
                      {/* Order number */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium font-mono text-[var(--color-text)]">
                          #{order.shopifyOrderNumber}
                        </span>
                        <span className="sm:hidden text-xs text-[var(--color-text-tertiary)]">
                          {formatDate(order.processedAt)}
                        </span>
                      </div>

                      {/* Amount */}
                      <div className="w-24 text-right font-medium text-[var(--color-text)] tabular-nums">
                        {formatCurrency(order.orderTotal)}
                      </div>

                      {/* Status */}
                      <div className="w-28 flex items-center justify-center">
                        <Badge variant={statusCfg.variant}>
                          {statusCfg.label}
                        </Badge>
                      </div>

                      {/* Invoice link */}
                      <div className="w-28">
                        {order.invoiceId ? (
                          <a
                            href={`/invoices?id=${order.invoiceId}`}
                            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors duration-200"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="underline underline-offset-2">
                              Rechnung
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            --
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      <div className="hidden sm:block w-24 text-right text-[var(--color-text-secondary)] tabular-nums">
                        {formatDate(order.processedAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
