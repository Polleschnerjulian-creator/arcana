"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Upload,
  Link2,
  FileText,
  Download,
  Shield,
  Plug,
  Check,
  ScanText,
  Bot,
  MousePointerClick,
  ArrowRight,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";

/* ─── Intersection Observer hook for fade-in ────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("landing-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`landing-reveal ${className}`}>
      {children}
    </div>
  );
}

/* ─── Glass Card ────────────────────────────────────────────── */
function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-mesh-1" />
        <div className="landing-mesh-2" />
        <div className="landing-mesh-3" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto">
        {/* Logo */}
        <Image
          src="/arcana-logo.png"
          alt="ARCANA"
          width={320}
          height={80}
          className="h-20 w-auto mb-10 invert"
          priority
        />

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] mb-6">
          Buchhaltung, die sich
          <br />
          <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
            selbst erledigt.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
          KI-native Buchhaltung für deutsche Unternehmen.
          <br className="hidden sm:block" /> Beleg hochladen. Fertig.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold text-lg px-8 py-4 transition-all duration-200 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Kostenlos starten
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl text-white font-medium text-lg px-8 py-4 transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2]"
          >
            Demo ansehen
          </a>
        </div>

        {/* Pipeline flow cards */}
        <div className="w-full max-w-3xl">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-0">
            {[
              { icon: Upload, label: "Beleg hochgeladen" },
              { icon: ScanText, label: "Texterkennung" },
              { icon: Bot, label: "KI-Extraktion" },
              { icon: Check, label: "Buchung erstellt" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-3 sm:gap-0">
                <GlassCard className="flex items-center gap-3 !p-4 sm:!px-5 sm:!py-3 whitespace-nowrap">
                  <step.icon className="w-5 h-5 text-white/60 flex-shrink-0" />
                  <span className="text-sm text-white/80 font-medium">
                    {step.label}
                  </span>
                </GlassCard>
                {i < 3 && (
                  <ArrowRight className="w-4 h-4 text-white/20 mx-2 hidden sm:block flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   "FRAG ARCANA" — Chat demo
   ═══════════════════════════════════════════════════════════════ */
function ChatDemo() {
  return (
    <section id="demo" className="py-24 sm:py-32 px-6">
      <RevealSection className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            KI-Assistent
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
            Frag ARCANA
          </h2>
          <p className="text-lg text-white/50 max-w-xl mx-auto">
            Frag einfach. ARCANA antwortet.
          </p>
        </div>

        {/* Mock chat */}
        <GlassCard className="max-w-2xl mx-auto !p-0 overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white/60" />
            </div>
            <span className="text-sm font-medium text-white/80">
              Frag ARCANA
            </span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/40">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="p-6 space-y-5">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-white/[0.1] rounded-2xl rounded-br-sm px-5 py-3 max-w-[85%]">
                <p className="text-sm text-white/90">
                  Wie viel habe ich diesen Monat für Software ausgegeben?
                </p>
              </div>
            </div>

            {/* ARCANA response */}
            <div className="flex justify-start gap-3">
              <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-white/60" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl rounded-bl-sm px-5 py-3 max-w-[85%]">
                <p className="text-sm text-white/90 leading-relaxed">
                  Diesen Monat:{" "}
                  <span className="font-semibold text-white">2.847,50 €</span>{" "}
                  für Software (Konto 4950).
                  <br />
                  <span className="text-white/50">
                    Das sind 12% mehr als letzten Monat.
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Input mock */}
          <div className="px-6 pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
              <span className="text-sm text-white/30 flex-1">
                Frag ARCANA etwas...
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white/40" />
              </div>
            </div>
          </div>
        </GlassCard>
      </RevealSection>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES GRID
   ═══════════════════════════════════════════════════════════════ */
const features = [
  {
    icon: Upload,
    title: "Beleg → Buchung in Sekunden",
    description:
      "Foto oder PDF hochladen. ARCANA erkennt Lieferant, Betrag, Steuer und bucht automatisch.",
  },
  {
    icon: Link2,
    title: "Bank-Matching mit KI",
    description:
      "Bankumsätze werden automatisch den richtigen Belegen zugeordnet. Lernend mit jeder Bestätigung.",
  },
  {
    icon: FileText,
    title: "Rechnungen erstellen",
    description:
      "Professionelle Rechnungen in Sekunden. Wiederkehrende Rechnungen automatisch versenden.",
  },
  {
    icon: Download,
    title: "DATEV-Export",
    description:
      "Ein Klick DATEV-Export. Dein Steuerberater bekommt die Daten genau so, wie er sie braucht.",
  },
  {
    icon: Shield,
    title: "GoBD-konform",
    description:
      "Revisionssicheres Archiv mit lückenloser Protokollierung. Finanzamt-ready ab Tag 1.",
  },
  {
    icon: Plug,
    title: "Shopify & Zapier",
    description:
      "Verbinde deine Tools. Shopify-Bestellungen werden automatisch zu Buchungen.",
  },
];

function FeaturesGrid() {
  return (
    <section className="py-24 sm:py-32 px-6">
      <RevealSection className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            Features
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
            Alles, was du brauchst.
            <br />
            <span className="text-white/40">Nichts, was du nicht brauchst.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <GlassCard
              key={f.title}
              className="group transition-all duration-300 hover:bg-white/[0.07] hover:border-white/[0.14]"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-white/[0.1]">
                <f.icon className="w-6 h-6 text-white/70" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">
                {f.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS (3 steps)
   ═══════════════════════════════════════════════════════════════ */
function HowItWorks() {
  return (
    <section className="py-24 sm:py-32 px-6">
      <RevealSection className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            So funktioniert&apos;s
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
            Drei Schritte. Fertig.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: Upload,
              title: "Beleg hochladen",
              description:
                "Foto machen oder PDF per Drag & Drop hochladen. Mehr musst du nicht tun.",
            },
            {
              step: "02",
              icon: Sparkles,
              title: "KI erkennt alles",
              description:
                "Texterkennung liest den Beleg. KI extrahiert Lieferant, Betrag, Steuer und schlägt das Konto vor.",
            },
            {
              step: "03",
              icon: MousePointerClick,
              title: "Ein Klick bestätigen",
              description:
                "Buchungsvorschlag prüfen, bestätigen — fertig. ARCANA lernt mit jeder Bestätigung dazu.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-6 mx-auto">
                <item.icon className="w-8 h-8 text-white/70" />
              </div>
              <div className="text-xs font-mono font-bold text-white/20 mb-3 tracking-widest">
                SCHRITT {item.step}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPARISON TABLE
   ═══════════════════════════════════════════════════════════════ */
function Comparison() {
  const rows = [
    { feature: "KI-Extraktion", sevdesk: false, lexoffice: false, arcana: true },
    { feature: "Automatische Buchung", sevdesk: false, lexoffice: false, arcana: true },
    { feature: "Chat-Assistent", sevdesk: false, lexoffice: false, arcana: true },
    { feature: "Lernende KI", sevdesk: false, lexoffice: false, arcana: true },
    { feature: "DATEV-Export", sevdesk: true, lexoffice: true, arcana: true },
    { feature: "GoBD-konform", sevdesk: true, lexoffice: true, arcana: true },
    { feature: "Bank-Integration", sevdesk: true, lexoffice: true, arcana: true },
  ];

  return (
    <section className="py-24 sm:py-32 px-6">
      <RevealSection className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            Vergleich
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
            Warum ARCANA?
          </h2>
          <p className="text-lg text-white/50 max-w-xl mx-auto">
            Die Features, die den Unterschied machen.
          </p>
        </div>

        <GlassCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-sm font-medium text-white/40 py-4 px-6 w-[40%]">
                    Feature
                  </th>
                  <th className="text-center text-sm font-medium text-white/40 py-4 px-4">
                    sevDesk
                  </th>
                  <th className="text-center text-sm font-medium text-white/40 py-4 px-4">
                    lexoffice
                  </th>
                  <th className="text-center text-sm font-medium text-white py-4 px-4 bg-white/[0.04]">
                    ARCANA
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={
                      i < rows.length - 1 ? "border-b border-white/[0.04]" : ""
                    }
                  >
                    <td className="text-sm text-white/80 py-4 px-6 font-medium">
                      {row.feature}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.sevdesk ? (
                        <Check className="w-5 h-5 text-white/30 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-white/15 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.lexoffice ? (
                        <Check className="w-5 h-5 text-white/30 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-white/15 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-4 px-4 bg-white/[0.04]">
                      <Check className="w-5 h-5 text-white mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </RevealSection>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════════ */
function Pricing() {
  const included = [
    "Unbegrenzte Belege",
    "KI-Extraktion & Buchung",
    "DATEV-Export",
    "Bank-Matching",
    "Chat-Assistent",
    "Rechnungserstellung",
    "GoBD-konformes Archiv",
    "Shopify-Integration",
  ];

  return (
    <section className="py-24 sm:py-32 px-6">
      <RevealSection className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
          Pricing
        </p>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
          Während der Beta:
          <br />
          <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Kostenlos.
          </span>
        </h2>
        <p className="text-lg text-white/50 mb-12">
          Keine Kreditkarte erforderlich. Kein Haken.
        </p>

        <GlassCard className="max-w-md mx-auto !p-8 text-left">
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-white mb-1">0 €</div>
            <div className="text-sm text-white/40">/ Monat während der Beta</div>
          </div>
          <ul className="space-y-3 mb-8">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white/80" />
                </div>
                <span className="text-sm text-white/70">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-white text-black font-semibold text-base px-8 py-4 transition-all duration-200 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Jetzt kostenlos starten
            <ArrowRight className="w-5 h-5" />
          </Link>
        </GlassCard>
      </RevealSection>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/arcana-logo.png"
              alt="ARCANA"
              width={120}
              height={30}
              className="h-7 w-auto invert"
            />
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-white/40">
            <Link
              href="/impressum"
              className="hover:text-white/70 transition-colors"
            >
              Impressum
            </Link>
            <Link
              href="/datenschutz"
              className="hover:text-white/70 transition-colors"
            >
              Datenschutz
            </Link>
            <a href="/agb" className="hover:text-white/70 transition-colors">
              AGB
            </a>
          </nav>

          {/* Made in Berlin */}
          <div className="flex items-center gap-2 text-sm text-white/30">
            <span>Made in Berlin</span>
            <span aria-label="Deutschland">&#x1F1E9;&#x1F1EA;</span>
          </div>
        </div>

        <div className="text-center mt-8 text-xs text-white/20">
          &copy; 2026 ARCANA. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="bg-black text-white min-h-screen selection:bg-white/20">
      <Hero />
      <ChatDemo />
      <FeaturesGrid />
      <HowItWorks />
      <Comparison />
      <Pricing />
      <Footer />
    </div>
  );
}
