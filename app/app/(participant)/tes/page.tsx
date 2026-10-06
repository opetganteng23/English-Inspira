"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type T = { id: string; name: string; kind: string; totalQuestions: number; totalSec: number; unlocked: boolean; inProgressAttemptId: string | null; lastScore: number | null };

export default function TesSaya() {
  const router = useRouter();
  const [tests, setTests] = useState<T[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/tests").then((r) => r.json()).then((d) => setTests(d.tests)).catch(() => setErr("Gagal memuat tes"));
  }, []);

  async function start(t: T) {
    setErr("");
    const r = await fetch(`/api/tests/${t.id}/start`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return setErr(d.error ?? "Gagal memulai");
    router.push(`/ruang-tes/${d.attemptId}`);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold text-navy">Tes Saya</h1>
      <p className="mt-1 text-ink-soft">Semua tes yang bisa kamu kerjakan.</p>
      {err && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!tests && !err && <p className="mt-6 text-ink-soft">Memuat…</p>}
      <div className="mt-6 flex flex-col gap-4">
        {tests?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
            <div>
              <h2 className="font-display text-lg font-extrabold text-navy">{t.name}</h2>
              <p className="text-sm text-ink-soft">{t.totalQuestions} soal · ±{Math.round(t.totalSec / 60)} menit{t.lastScore ? ` · skor terakhir ${t.lastScore}` : ""}</p>
            </div>
            {t.unlocked ? (
              <button onClick={() => start(t)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                {t.inProgressAttemptId ? "Lanjutkan" : "Mulai"}
              </button>
            ) : (
              <span className="rounded-xl bg-canvas px-4 py-2 text-sm font-semibold text-ink-soft">Terkunci</span>
            )}
          </div>
        ))}
        {tests?.length === 0 && <p className="text-ink-soft">Belum ada tes tersedia.</p>}
      </div>
    </div>
  );
}
