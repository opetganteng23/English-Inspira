import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Font di-host sendiri (file di app/fonts, lisensi OFL) agar build tidak bergantung pada akses ke Google Fonts.
const montserrat = localFont({
  src: [{ path: "./fonts/montserrat-700.woff2", weight: "700 800", style: "normal" }],
  variable: "--font-montserrat", display: "swap",
});
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-poppins", display: "swap",
});

export const metadata: Metadata = {
  title: "Edulyfe EPTA — English Proficiency Test & Analytics",
  description: "Persiapan TOEFL ITP: tes simulasi, analisis AI, dan Konselor AI.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F2F5E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${montserrat.variable} ${poppins.variable}`}>{children}</body>
    </html>
  );
}
