import Link from "next/link";
import { SessionProvider } from "@/components/providers/session-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
        {/* Animated gradient background */}
        <div
          className="fixed inset-0 -z-10 bg-[var(--color-bg)]"
          style={{
            background: "linear-gradient(135deg, #F5F5F7 0%, #ECECEE 30%, #F5F5F7 50%, #ECECEE 70%, #F5F5F7 100%)",
          }}
        />
        {/* Dark mode background overlay */}
        <div
          className="fixed inset-0 -z-10 hidden dark:block"
          style={{
            background: "linear-gradient(135deg, #000000 0%, #0A0A0A 30%, #000000 50%, #0A0A0A 70%, #000000 100%)",
          }}
        />

        {/* Animated gradient orbs */}
        <div
          className="fixed -z-10 h-[500px] w-[500px] rounded-full opacity-30 dark:opacity-15 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(0,0,0,0.08) 0%, transparent 70%)",
            top: "10%",
            left: "15%",
            animation: "orbFloat1 20s ease-in-out infinite",
          }}
        />
        {/* Dark mode orb variant */}
        <div
          className="fixed -z-10 h-[500px] w-[500px] rounded-full opacity-0 dark:opacity-20 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
            top: "10%",
            left: "15%",
            animation: "orbFloat1 20s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[400px] w-[400px] rounded-full opacity-20 dark:opacity-0 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(0,0,0,0.1) 0%, transparent 70%)",
            bottom: "10%",
            right: "10%",
            animation: "orbFloat2 25s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[400px] w-[400px] rounded-full opacity-0 dark:opacity-15 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
            bottom: "10%",
            right: "10%",
            animation: "orbFloat2 25s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[350px] w-[350px] rounded-full opacity-15 dark:opacity-0 blur-[90px]"
          style={{
            background: "radial-gradient(circle, rgba(0,0,0,0.06) 0%, transparent 70%)",
            top: "50%",
            right: "30%",
            animation: "orbFloat3 18s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[350px] w-[350px] rounded-full opacity-0 dark:opacity-10 blur-[90px]"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
            top: "50%",
            right: "30%",
            animation: "orbFloat3 18s ease-in-out infinite",
          }}
        />

        {/* Glass auth card */}
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-8 md:p-10 auth-glass-card"
          >
            {/* ARCANA Branding */}
            <div className="mb-8 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/arcana-logo.png" alt="ARCANA" className="h-10 mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                AI-native Buchhaltung
              </p>
            </div>
            {children}
          </div>
          <div className="mt-6 text-center text-xs text-[var(--color-text-tertiary)]">
            <Link href="/impressum" className="hover:text-[var(--color-text-secondary)] transition-colors">Impressum</Link>
            <span className="mx-2">&middot;</span>
            <Link href="/datenschutz" className="hover:text-[var(--color-text-secondary)] transition-colors">Datenschutz</Link>
          </div>
        </div>

        {/* CSS keyframes for orb animations */}
        <style>{`
          @keyframes orbFloat1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -40px) scale(1.05); }
            66% { transform: translate(-20px, 20px) scale(0.95); }
          }
          @keyframes orbFloat2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(-40px, 30px) scale(1.1); }
            66% { transform: translate(25px, -15px) scale(0.9); }
          }
          @keyframes orbFloat3 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(35px, 25px) scale(1.08); }
          }
        `}</style>
      </div>
    </SessionProvider>
  );
}
