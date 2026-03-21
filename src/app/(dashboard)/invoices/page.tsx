import Link from "next/link";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Rechnungen
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Ausgangsrechnungen erstellen, versenden und verfolgen
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-sm w-full text-center">
          {/* Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 border border-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                <path d="M14 8H8" />
                <path d="M16 12H8" />
                <path d="M13 16H8" />
              </svg>
            </div>
          </div>

          {/* Text */}
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Kommt bald
          </h2>
          <p className="text-sm text-text-secondary mb-8 leading-relaxed">
            Ausgangsrechnungen erstellen, versenden und verfolgen.
            Diese Funktion wird in einem kommenden Update verfuegbar sein.
          </p>

          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg border border-border bg-surface text-text-primary hover:bg-gray-50 h-10 px-5 text-sm gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Zurueck zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
