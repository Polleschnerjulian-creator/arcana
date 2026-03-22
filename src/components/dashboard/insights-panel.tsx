"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Clock,
  Inbox,
  Calendar,
  Trophy,
  AlertTriangle,
  X,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { Insight } from "@/lib/ai/insights";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Clock,
  Inbox,
  Calendar,
  Trophy,
  AlertTriangle,
};

const TYPE_STYLES: Record<
  Insight["type"],
  { border: string; iconBg: string; iconColor: string }
> = {
  warning: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  success: {
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  action: {
    border: "border-l-[var(--color-text)]",
    iconBg: "bg-black/[0.06] dark:bg-white/[0.08]",
    iconColor: "text-[var(--color-text)]",
  },
  info: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
};

export function InsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Load dismissed insights from localStorage
    try {
      const stored = localStorage.getItem("arcana-dismissed-insights");
      if (stored) {
        setDismissed(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }

    // Fetch insights
    async function fetchInsights() {
      try {
        const res = await fetch("/api/insights");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setInsights(data.data);
          }
        }
      } catch {
        // silent fail — insights are non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      localStorage.setItem(
        "arcana-dismissed-insights",
        JSON.stringify(Array.from(next))
      );
    } catch {
      // ignore
    }
  };

  const visibleInsights = insights.filter((i) => !dismissed.has(i.id));
  const displayInsights = expanded
    ? visibleInsights
    : visibleInsights.slice(0, 3);
  const hasMore = visibleInsights.length > 3;

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 animate-in">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Insights werden geladen...
          </span>
        </div>
      </div>
    );
  }

  if (visibleInsights.length === 0) return null;

  return (
    <div className="space-y-3 animate-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-text-secondary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Smart Insights
        </h2>
      </div>

      {/* Insight Cards */}
      <div className="grid gap-3">
        {displayInsights.map((insight, i) => {
          const style = TYPE_STYLES[insight.type];
          const IconComponent = ICON_MAP[insight.icon] ?? Sparkles;

          return (
            <div
              key={insight.id}
              className={`
                glass rounded-2xl overflow-hidden border-l-[3px] ${style.border}
                animate-in
              `}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="p-4 flex items-start gap-3.5">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-xl ${style.iconBg} flex items-center justify-center`}
                >
                  <IconComponent className={`h-4.5 w-4.5 ${style.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] leading-snug">
                    {insight.title}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    {insight.description}
                  </p>

                  {insight.actionUrl && insight.actionLabel && (
                    <Link
                      href={insight.actionUrl}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text)] mt-2 hover:underline underline-offset-2 group"
                    >
                      {insight.actionLabel}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => dismiss(insight.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all"
                  title="Ausblenden"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mx-auto"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
          {expanded
            ? "Weniger anzeigen"
            : `${visibleInsights.length - 3} weitere anzeigen`}
        </button>
      )}
    </div>
  );
}
