import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PREFS_BOOT } from "@/components/UiPrefs";

// Poppins di-host sendiri (file di app/fonts, lisensi OFL): satu-satunya font aplikasi, termasuk judul.
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins", display: "swap",
});

export const metadata: Metadata = {
  title: "English Inspira | TOEFL ITP Preparation",
  description: "TOEFL ITP preparation: simulation tests, AI analysis, and an AI Counselor.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F8FD" }, { media: "(prefers-color-scheme: dark)", color: "#0C1424" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} /></head>
      <body className={`${poppins.variable}`}>{children}</body>
    </html>
  );
}
