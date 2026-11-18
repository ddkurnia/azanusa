import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Amiri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
});

const fontArabic = Amiri({
  variable: "--font-arabic-app",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AZANUSA — Jadwal Salat & Azan Otomatis",
    template: "%s | AZANUSA",
  },
  description:
    "Satu Indonesia, Satu Pengingat Waktu Salat. Jadwal salat lima waktu untuk 38 provinsi dan 514 kabupaten/kota di seluruh Indonesia dengan hitung mundur azan, WIB/WITA/WIT, kalender Hijriah, arah kiblat, doa, dan zikir.",
  keywords: [
    "AZANUSA",
    "jadwal salat",
    "jadwal sholat",
    "azan",
    "adzan",
    "Indonesia",
    "WIB WITA WIT",
    "PWA",
    "Kemenag",
  ],
  applicationName: "AZANUSA",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "AZANUSA — Jadwal Salat & Azan Otomatis",
    description:
      "Satu Indonesia, Satu Pengingat Waktu Salat. Jadwal salat lima waktu seluruh Indonesia.",
    siteName: "AZANUSA",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7a55",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontArabic.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
