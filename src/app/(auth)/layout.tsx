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
          className="fixed inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, #F5F5F7 0%, #E8F5F3 30%, #F0FDFA 50%, #F5F5F7 70%, #EDF2F7 100%)",
          }}
        />

        {/* Animated gradient orbs */}
        <div
          className="fixed -z-10 h-[500px] w-[500px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(13,148,136,0.4) 0%, transparent 70%)",
            top: "10%",
            left: "15%",
            animation: "orbFloat1 20s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(20,184,166,0.5) 0%, transparent 70%)",
            bottom: "10%",
            right: "10%",
            animation: "orbFloat2 25s ease-in-out infinite",
          }}
        />
        <div
          className="fixed -z-10 h-[350px] w-[350px] rounded-full opacity-15 blur-[90px]"
          style={{
            background: "radial-gradient(circle, rgba(13,148,136,0.3) 0%, transparent 70%)",
            top: "50%",
            right: "30%",
            animation: "orbFloat3 18s ease-in-out infinite",
          }}
        />

        {/* Glass auth card */}
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{
              background: "rgba(255, 255, 255, 0.72)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
            }}
          >
            {/* ARCANA Branding */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-br from-primary to-teal-400 bg-clip-text text-transparent">A</span>
                <span className="text-[var(--color-text)]">RCANA</span>
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                AI-native Buchhaltung
              </p>
            </div>
            {children}
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
