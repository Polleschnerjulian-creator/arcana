import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARCANA - AI-native Buchhaltung",
  description:
    "AI-native Buchhaltungsplattform fuer deutsche Unternehmen. Automatische Belegerfassung, intelligente Kontierung, DATEV-Export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
