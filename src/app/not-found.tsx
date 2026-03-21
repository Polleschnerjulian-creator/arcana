import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="de">
      <body className="font-sans antialiased bg-[#F5F5F7] text-[#1D1D1F]">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="max-w-md w-full text-center">
            {/* 404 Number */}
            <div className="mb-8 animate-float">
              <span className="text-8xl font-extralight tracking-tight text-[#86868B]/40 select-none">
                404
              </span>
            </div>

            {/* Message */}
            <h1 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              Seite nicht gefunden
            </h1>
            <p className="text-sm text-[#86868B] mb-10 max-w-xs mx-auto leading-relaxed">
              Die angeforderte Seite existiert nicht oder wurde verschoben.
            </p>

            {/* Glass Button */}
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 h-11 px-8 text-sm font-medium rounded-2xl text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "#1D1D1F",
                boxShadow: "0 0 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
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

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}} />
      </body>
    </html>
  );
}
