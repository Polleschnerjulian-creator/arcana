import { SessionProvider } from "@/components/providers/session-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          {/* ARCANA Branding */}
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white font-bold text-xl">
              A
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
              ARCANA
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              AI-native Buchhaltung
            </p>
          </div>
          {children}
        </div>
      </div>
    </SessionProvider>
  );
}
