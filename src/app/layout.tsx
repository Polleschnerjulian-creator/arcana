import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ARCANA - AI-native Buchhaltung",
    template: "%s | ARCANA",
  },
  description:
    "AI-native Buchhaltungsplattform fuer deutsche Unternehmen. Automatische Belegerfassung, intelligente Kontierung, DATEV-Export.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231D1D1F'/><text x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='700' font-size='18' fill='white'>A</text></svg>",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1D1D1F",
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
