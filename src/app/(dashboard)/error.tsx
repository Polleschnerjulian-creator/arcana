"use client";

import * as React from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/arcana-logo.png" alt="ARCANA" className="h-10" />
        </div>

        {/* Error Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-danger"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Ein Fehler ist aufgetreten
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Beim Laden dieser Seite ist ein unerwarteter Fehler aufgetreten.
          Bitte versuchen Sie es erneut.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg bg-primary text-white hover:bg-primary-hover active:bg-primary-hover h-10 px-5 text-sm"
          >
            Erneut versuchen
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg border border-border bg-surface text-text-primary hover:bg-gray-50 h-10 px-5 text-sm"
          >
            Zur Startseite
          </Link>
        </div>

        {/* Error Details (expandable) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {showDetails ? "Details ausblenden" : "Technische Details anzeigen"}
            </button>
            {showDetails && (
              <div className="mt-3 p-4 rounded-lg bg-gray-50 border border-border text-left overflow-auto max-h-48">
                <p className="text-xs font-medium text-text-secondary mb-1">
                  {error.name}: {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-text-muted mb-2">
                    Digest: {error.digest}
                  </p>
                )}
                {error.stack && (
                  <pre className="text-xs text-text-muted whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
