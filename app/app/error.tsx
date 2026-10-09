"use client";

import Link from "next/link";
import { useEffect } from "react";

// Setelah deploy, halaman yang masih terbuka dari build lama gagal memuat chunk JS yang sudah tidak ada.
// Kasus itu dipulihkan dengan memuat ulang halaman sekali (dijaga sessionStorage agar tidak berulang).
const STALE = /ChunkLoadError|Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Loading CSS chunk/i;

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (!STALE.test(`${error?.name} ${error?.message}`)) return;
    try {
      const key = "ei-stale-reload";
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { /* tanpa storage: tetap muat ulang sekali */ }
    window.location.reload();
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-5xl font-extrabold text-navy">Oops.</p>
      <h1 className="font-display text-2xl font-extrabold text-navy">Something went wrong</h1>
      <p className="max-w-md text-ink-soft">Not your fault. Try reloading the page; if it keeps happening, contact the admin through the Help menu.</p>
      <div className="flex gap-3">
        <button onClick={() => { reset(); window.location.reload(); }} className="btn-solid">Reload</button>
        <Link href="/" className="btn-outline">Go to home</Link>
      </div>
    </main>
  );
}
