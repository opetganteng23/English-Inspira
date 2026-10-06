import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-montserrat" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "Edulyfe EPTA — English Proficiency Test & Analytics",
  description: "Persiapan TOEFL ITP: tes simulasi, analisis AI, dan Konselor AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${montserrat.variable} ${poppins.variable}`}>{children}</body>
    </html>
  );
}
