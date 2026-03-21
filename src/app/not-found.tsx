import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="de">
      <body className="font-sans antialiased bg-[#FAFAF9] text-[#1C1917]">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="max-w-md w-full text-center">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488] text-white font-bold text-lg">
                A
              </div>
              <span className="text-xl font-semibold tracking-tight">
                ARCANA
              </span>
            </div>

            {/* 404 */}
            <div className="mb-6">
              <span className="text-7xl font-bold tracking-tight text-[#E7E5E4]">
                404
              </span>
            </div>

            {/* Message */}
            <h1 className="text-xl font-semibold mb-2">
              Seite nicht gefunden
            </h1>
            <p className="text-sm text-[#78716C] mb-8">
              Die angeforderte Seite existiert nicht oder wurde verschoben.
            </p>

            {/* Action */}
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center font-medium transition-colors rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E] h-10 px-6 text-sm gap-2"
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
      </body>
    </html>
  );
}
