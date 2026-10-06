"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-5xl font-extrabold text-navy">Ups.</p>
      <h1 className="font-display text-2xl font-extrabold text-navy">Terjadi kesalahan</h1>
      <p className="max-w-md text-ink-soft">Bukan salahmu. Coba muat ulang; kalau masih terjadi, hubungi admin lewat menu Bantuan.</p>
      <div className="flex gap-3"><button onClick={reset} className="btn-solid">Coba lagi</button><Link href="/" className="btn-outline">Ke beranda</Link></div>
    </main>
  );
}
