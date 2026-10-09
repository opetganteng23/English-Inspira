"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-5xl font-extrabold text-navy">Ups.</p>
      <h1 className="font-display text-2xl font-extrabold text-navy">Something went wrong</h1>
      <p className="max-w-md text-ink-soft">Not your fault. Try reloading; if it keeps happening, contact the admin through the Help menu.</p>
      <div className="flex gap-3"><button onClick={reset} className="btn-solid">Try again</button><Link href="/" className="btn-outline">Go to home</Link></div>
    </main>
  );
}
