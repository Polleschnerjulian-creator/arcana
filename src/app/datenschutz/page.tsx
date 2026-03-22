import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | ARCANA",
  description:
    "Datenschutzerklärung gemäß DSGVO für die ARCANA Buchhaltungsplattform",
};

export default function DatenschutzPage() {
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
            Datenschutzerklärung
          </h1>

          <div className="space-y-12 text-white/70 leading-relaxed">
            {/* 1. Datenschutz auf einen Blick */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Datenschutz auf einen Blick
              </h2>
              <h3 className="text-lg font-medium text-white/90 mb-2">
                Allgemeine Hinweise
              </h3>
              <p>
                Die folgenden Hinweise geben einen einfachen Überblick darüber,
                was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
                Website besuchen. Personenbezogene Daten sind alle Daten, mit
                denen Sie persönlich identifiziert werden können. Ausführliche
                Informationen zum Thema Datenschutz entnehmen Sie unserer
                nachfolgend aufgeführten Datenschutzerklärung.
              </p>
              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Datenerfassung auf dieser Website
              </h3>
              <p className="mb-3">
                <strong className="text-white">
                  Wer ist verantwortlich für die Datenerfassung auf dieser
                  Website?
                </strong>
              </p>
              <p>
                Die Datenverarbeitung auf dieser Website erfolgt durch den
                Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt
                &ldquo;Verantwortlicher&rdquo; in dieser Datenschutzerklärung
                entnehmen.
              </p>
              <p className="mt-3 mb-3">
                <strong className="text-white">
                  Wie erfassen wir Ihre Daten?
                </strong>
              </p>
              <p>
                Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese
                mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie
                in ein Kontaktformular eingeben oder bei der Registrierung
                angeben. Andere Daten werden automatisch oder nach Ihrer
                Einwilligung beim Besuch der Website durch unsere IT-Systeme
                erfasst. Das sind vor allem technische Daten (z.B.
                Internetbrowser, Betriebssystem oder Uhrzeit des
                Seitenaufrufs).
              </p>
              <p className="mt-3 mb-3">
                <strong className="text-white">
                  Wofür nutzen wir Ihre Daten?
                </strong>
              </p>
              <p>
                Ein Teil der Daten wird erhoben, um eine fehlerfreie
                Bereitstellung der Website zu gewährleisten. Andere Daten können
                zur Analyse Ihres Nutzerverhaltens verwendet werden. Wenn Sie
                die Buchhaltungsplattform nutzen, werden Ihre Daten zur
                Erbringung der vertraglich vereinbarten Dienstleistungen
                verarbeitet.
              </p>
            </section>

            {/* 2. Verantwortlicher */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. Verantwortlicher
              </h2>
              <p>
                [TODO: Firmenname]
                <br />
                [TODO: Straße]
                <br />
                [TODO: PLZ Ort]
                <br />
                Deutschland
              </p>
              <p className="mt-3">
                Telefon: [TODO: Telefonnummer]
                <br />
                E-Mail: [TODO: E-Mail-Adresse]
              </p>
              <p className="mt-3">
                Verantwortliche Stelle ist die natürliche oder juristische
                Person, die allein oder gemeinsam mit anderen über die Zwecke
                und Mittel der Verarbeitung von personenbezogenen Daten (z.B.
                Namen, E-Mail-Adressen o.Ä.) entscheidet.
              </p>
            </section>

            {/* 3. Hosting */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. Hosting
              </h2>
              <p>
                Diese Website wird bei Vercel Inc., 440 N Barranca Ave #4133,
                Covina, CA 91723, USA gehostet. Wenn Sie unsere Website
                besuchen, werden Ihre personenbezogenen Daten auf den Servern
                von Vercel verarbeitet. Hierbei können auch personenbezogene
                Daten an den Sitz von Vercel in den USA übermittelt werden.
              </p>
              <p className="mt-3">
                Die Verwendung von Vercel erfolgt auf Grundlage von Art. 6 Abs.
                1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an einer
                möglichst zuverlässigen Darstellung unserer Website. Sofern eine
                entsprechende Einwilligung abgefragt wurde, erfolgt die
                Verarbeitung ausschließlich auf Grundlage von Art. 6 Abs. 1
                lit. a DSGVO.
              </p>
              <p className="mt-3">
                Die Datenübertragung in die USA wird auf die
                Standardvertragsklauseln der EU-Kommission gestützt. Details
                finden Sie in der Datenschutzerklärung von Vercel:{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  https://vercel.com/legal/privacy-policy
                </a>
              </p>
            </section>

            {/* 4. Datenbank */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Datenbank
              </h2>
              <p>
                Wir nutzen Neon Tech Inc. als Datenbankdienstleister. Ihre Daten
                werden in einer PostgreSQL-Datenbank gespeichert, deren Server
                sich in der EU (Frankfurt am Main, Deutschland) befinden.
              </p>
              <p className="mt-3">
                Die Nutzung von Neon erfolgt auf Grundlage von Art. 6 Abs. 1
                lit. f DSGVO bzw. Art. 6 Abs. 1 lit. b DSGVO, soweit die
                Verarbeitung zur Erfüllung vertraglicher Pflichten erforderlich
                ist. Weitere Informationen finden Sie in der
                Datenschutzerklärung von Neon:{" "}
                <a
                  href="https://neon.tech/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  https://neon.tech/privacy-policy
                </a>
              </p>
            </section>

            {/* 5. Allgemeine Hinweise und Pflichtinformationen */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Allgemeine Hinweise und Pflichtinformationen
              </h2>

              <h3 className="text-lg font-medium text-white/90 mb-2">
                Datenschutz
              </h3>
              <p>
                Die Betreiber dieser Seiten nehmen den Schutz Ihrer
                persönlichen Daten sehr ernst. Wir behandeln Ihre
                personenbezogenen Daten vertraulich und entsprechend den
                gesetzlichen Datenschutzvorschriften sowie dieser
                Datenschutzerklärung.
              </p>
              <p className="mt-3">
                Wir weisen darauf hin, dass die Datenübertragung im Internet
                (z.B. bei der Kommunikation per E-Mail) Sicherheitslücken
                aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff
                durch Dritte ist nicht möglich.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Hinweis zur verantwortlichen Stelle
              </h3>
              <p>
                Die verantwortliche Stelle für die Datenverarbeitung auf dieser
                Website ist im Abschnitt &ldquo;Verantwortlicher&rdquo;
                aufgeführt. Verantwortliche Stelle ist die natürliche oder
                juristische Person, die allein oder gemeinsam mit anderen über
                die Zwecke und Mittel der Verarbeitung von personenbezogenen
                Daten entscheidet.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Widerruf Ihrer Einwilligung zur Datenverarbeitung
              </h3>
              <p>
                Viele Datenverarbeitungsvorgänge sind nur mit Ihrer
                ausdrücklichen Einwilligung möglich. Sie können eine bereits
                erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit
                der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom
                Widerruf unberührt.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Speicherdauer
              </h3>
              <p>
                Soweit innerhalb dieser Datenschutzerklärung keine speziellere
                Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen
                Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt.
                Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine
                Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten
                gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe
                für die Speicherung Ihrer personenbezogenen Daten haben (z.B.
                steuer- oder handelsrechtliche Aufbewahrungsfristen); im
                letztgenannten Fall erfolgt die Löschung nach Fortfall dieser
                Gründe.
              </p>
            </section>

            {/* 6. Datenerfassung auf dieser Website */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Datenerfassung auf dieser Website
              </h2>

              <h3 className="text-lg font-medium text-white/90 mb-2">
                Cookies
              </h3>
              <p>
                Unsere Website verwendet Cookies. Dabei handelt es sich
                ausschließlich um technisch notwendige Session-Cookies, die für
                die Authentifizierung und den Betrieb der Plattform erforderlich
                sind. Diese Cookies werden nach Beendigung Ihrer
                Browser-Sitzung automatisch gelöscht.
              </p>
              <p className="mt-3">
                Die Speicherung dieser Cookies erfolgt auf Grundlage von Art. 6
                Abs. 1 lit. f DSGVO. Der Websitebetreiber hat ein berechtigtes
                Interesse an der technisch fehlerfreien Bereitstellung seiner
                Dienste. Eine Einwilligung ist hierfür nicht erforderlich, da es
                sich um technisch notwendige Cookies handelt.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Server-Log-Dateien
              </h3>
              <p>
                Der Provider der Seiten erhebt und speichert automatisch
                Informationen in so genannten Server-Log-Dateien, die Ihr
                Browser automatisch an uns übermittelt. Dies sind:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-1">
                <li>Browsertyp und Browserversion</li>
                <li>Verwendetes Betriebssystem</li>
                <li>Referrer URL</li>
                <li>Hostname des zugreifenden Rechners</li>
                <li>Uhrzeit der Serveranfrage</li>
                <li>IP-Adresse</li>
              </ul>
              <p className="mt-3">
                Eine Zusammenführung dieser Daten mit anderen Datenquellen wird
                nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf
                Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Registrierung und Nutzerkonto
              </h3>
              <p>
                Sie können auf unserer Website ein Nutzerkonto anlegen. Bei der
                Registrierung erheben wir Ihre E-Mail-Adresse und ein Passwort.
                Ihre Daten werden zum Zweck der Bereitstellung der
                Buchhaltungsplattform verarbeitet (Art. 6 Abs. 1 lit. b DSGVO).
                Sie können Ihr Nutzerkonto jederzeit löschen.
              </p>
            </section>

            {/* 7. Analyse-Tools und Werbung */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Analyse-Tools und Werbung
              </h2>
              <p>
                Derzeit setzen wir keine Analyse-Tools oder Werbedienste auf
                dieser Website ein. Sollte sich dies in Zukunft ändern, werden
                wir diese Datenschutzerklärung entsprechend aktualisieren und
                Sie darüber informieren.
              </p>
            </section>

            {/* 8. Zahlungsdaten */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Zahlungsdaten
              </h2>
              <p>
                Im Rahmen der Buchhaltungsplattform verarbeiten wir
                Buchhaltungsdaten, die Sie in das System eingeben. Diese Daten
                werden verschlüsselt gespeichert und GoBD-konform archiviert.
              </p>
              <p className="mt-3">
                Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. c DSGVO
                (Erfüllung rechtlicher Verpflichtungen, insbesondere
                steuerrechtlicher Aufbewahrungspflichten).
              </p>
              <p className="mt-3">
                Buchhaltungsdaten werden gemäß den gesetzlichen
                Aufbewahrungsfristen (in der Regel 10 Jahre gemäß §257 HGB und
                §147 AO) gespeichert und nach Ablauf dieser Fristen gelöscht.
              </p>
            </section>

            {/* 9. Drittanbieter-Dienste */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                9. Drittanbieter-Dienste
              </h2>

              <h3 className="text-lg font-medium text-white/90 mb-2">
                Anthropic (KI-Verarbeitung)
              </h3>
              <p>
                Wir nutzen die KI-Dienste von Anthropic, PBC (548 Market St,
                PMB 90375, San Francisco, CA 94104, USA) zur automatischen
                Verarbeitung von Belegen und zur Bereitstellung des
                KI-Assistenten. Dabei können Belegdaten (z.B. Rechnungstexte,
                Beträge) an die Server von Anthropic übermittelt werden.
              </p>
              <p className="mt-3">
                Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                DSGVO. Die Datenübertragung in die USA wird auf die
                Standardvertragsklauseln der EU-Kommission gestützt. Weitere
                Informationen:{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  https://www.anthropic.com/privacy
                </a>
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Resend (E-Mail-Versand)
              </h3>
              <p>
                Für den Versand von E-Mails (z.B. Registrierungsbestätigungen,
                Benachrichtigungen) nutzen wir den Dienst Resend (Resend Inc.).
                Dabei werden E-Mail-Adressen und E-Mail-Inhalte an Resend
                übermittelt.
              </p>
              <p className="mt-3">
                Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                DSGVO bzw. Art. 6 Abs. 1 lit. f DSGVO. Weitere Informationen:{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  https://resend.com/legal/privacy-policy
                </a>
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Vercel Blob (Dateispeicher)
              </h3>
              <p>
                Hochgeladene Dateien (z.B. Belege, Rechnungen) werden über
                Vercel Blob gespeichert. Die Daten werden auf Servern von Vercel
                verarbeitet und können in die USA übermittelt werden.
              </p>
              <p className="mt-3">
                Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                DSGVO. Die Datenübertragung in die USA wird auf die
                Standardvertragsklauseln der EU-Kommission gestützt.
              </p>
            </section>

            {/* 10. Ihre Rechte */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                10. Ihre Rechte
              </h2>
              <p className="mb-4">
                Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen
                jederzeit folgende Rechte bezüglich Ihrer personenbezogenen
                Daten:
              </p>

              <h3 className="text-lg font-medium text-white/90 mb-2">
                Recht auf Auskunft (Art. 15 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, eine Bestätigung darüber zu verlangen, ob
                betreffende personenbezogene Daten verarbeitet werden, und auf
                Auskunft über diese Daten sowie auf weitere Informationen und
                Kopie der Daten.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Recht auf Berichtigung (Art. 16 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, die Vervollständigung der Sie betreffenden
                Daten oder die Berichtigung unrichtiger Daten zu verlangen.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Recht auf Löschung (Art. 17 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, zu verlangen, dass betreffende Daten
                unverzüglich gelöscht werden, sofern keine gesetzlichen
                Aufbewahrungspflichten entgegenstehen.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer
                personenbezogenen Daten zu verlangen.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Recht auf Datenübertragbarkeit (Art. 20 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, die Sie betreffenden Daten, die Sie uns
                bereitgestellt haben, in einem strukturierten, gängigen und
                maschinenlesbaren Format zu erhalten und diese Daten einem
                anderen Verantwortlichen zu übermitteln.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Widerspruchsrecht (Art. 21 DSGVO)
              </h3>
              <p>
                Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen
                Situation ergeben, jederzeit gegen die Verarbeitung der Sie
                betreffenden personenbezogenen Daten Widerspruch einzulegen.
              </p>

              <h3 className="text-lg font-medium text-white/90 mt-6 mb-2">
                Beschwerderecht bei der Aufsichtsbehörde
              </h3>
              <p>
                Unbeschadet eines anderweitigen verwaltungsrechtlichen oder
                gerichtlichen Rechtsbehelfs steht Ihnen das Recht auf
                Beschwerde bei einer Aufsichtsbehörde zu, wenn Sie der Ansicht
                sind, dass die Verarbeitung der Sie betreffenden
                personenbezogenen Daten gegen die DSGVO verstößt.
              </p>
            </section>

            {/* 11. SSL-/TLS-Verschlüsselung */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                11. SSL-/TLS-Verschlüsselung
              </h2>
              <p>
                Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der
                Übertragung vertraulicher Inhalte, wie zum Beispiel
                Buchhaltungsdaten, Anfragen oder Bestellungen, die Sie an uns
                als Seitenbetreiber senden, eine SSL- bzw. TLS-Verschlüsselung.
                Eine verschlüsselte Verbindung erkennen Sie daran, dass die
                Adresszeile des Browsers von &ldquo;http://&rdquo; auf
                &ldquo;https://&rdquo; wechselt und an dem Schloss-Symbol in
                Ihrer Browserzeile.
              </p>
              <p className="mt-3">
                Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können
                die Daten, die Sie an uns übermitteln, nicht von Dritten
                mitgelesen werden.
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
              href="/impressum"
              className="hover:text-white/70 transition-colors"
            >
              Impressum
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
