import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum | ARCANA",
  description: "Impressum und Angaben gemäß § 5 TMG",
};

export default function ImpressumPage() {
  return (
    <div className="bg-black text-white min-h-screen selection:bg-white/20">
      {/* Header */}
      <header className="py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/arcana-logo.png"
              alt="ARCANA"
              className="h-8 w-auto invert"
            />
          </Link>
          <Link
            href="/"
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Zurück zur Startseite
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-12">
            Impressum
          </h1>

          <div className="space-y-10 text-white/70 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Angaben gemäß § 5 TMG
              </h2>
              <p>
                [TODO: Firmenname]
                <br />
                [TODO: Rechtsform, z.B. UG (haftungsbeschränkt)]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Vertreten durch
              </h2>
              <p>[TODO: Geschäftsführer]</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Kontakt
              </h2>
              <p>
                E-Mail: [TODO: E-Mail-Adresse]
                <br />
                Telefon: [TODO: Telefonnummer]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Anschrift
              </h2>
              <p>
                [TODO: Straße]
                <br />
                [TODO: PLZ Ort]
                <br />
                Deutschland
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Registereintrag
              </h2>
              <p>[TODO: Handelsregister, Registergericht, Registernummer]</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Umsatzsteuer-ID
              </h2>
              <p>[TODO: USt-IdNr. gemäß §27a UStG]</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
              </h2>
              <p>[TODO: Name, Anschrift]</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Streitschlichtung
              </h2>
              <p>
                Die Europäische Kommission stellt eine Plattform zur
                Online-Streitbeilegung (OS) bereit:{" "}
                <a
                  href="https://ec.europa.eu/consumers/odr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
              </p>
              <p className="mt-3">
                Wir sind nicht bereit oder verpflichtet, an
                Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <nav className="flex items-center gap-6">
            <Link
              href="/datenschutz"
              className="hover:text-white/70 transition-colors"
            >
              Datenschutz
            </Link>
            <Link href="/" className="hover:text-white/70 transition-colors">
              Startseite
            </Link>
          </nav>
          <span className="text-xs text-white/20">
            &copy; 2026 ARCANA. Alle Rechte vorbehalten.
          </span>
        </div>
      </footer>
    </div>
  );
}
