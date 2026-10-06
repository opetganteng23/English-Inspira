import Link from "next/link";
import { Logo } from "@/components/Logo";

// Placeholder; landing penuh (layar 01) dibangun setelah fondasi.
export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-center text-white">
      <Logo />
      <h1 className="font-display text-4xl font-extrabold">English Proficiency Test &amp; Analytics</h1>
      <p className="max-w-md text-mist">Tes simulasi TOEFL ITP, analisis AI per section, dan Konselor AI.</p>
      <Link href="/masuk" className="rounded-xl bg-accent px-8 py-3 font-semibold text-white hover:bg-accent-dark">Masuk / Daftar</Link>
    </main>
  );
}
