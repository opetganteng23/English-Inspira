"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Sec = { section: string; raw: number; total: number; scaled: number };
type Rev = { no: number; section: string; type: string; correct: boolean; answered: boolean; locked: boolean; stem?: string; options?: string[]; yourChoice?: number | null; answerKey?: number; explanation?: string };
type R = { kind: string; testName: string; durationSec: number | null; scoreEst: number; scoreRange: [number, number] | null; sectionScores: Sec[]; flags: number; review: Rev[] };

const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

export default function Hasil({ params }: { params: { id: string } }) {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/attempts/${params.id}/result`).then(async (x) => { const d = await x.json(); if (x.ok) setR(d); else setErr(d.error); }).catch(() => setErr("Gagal memuat hasil"));
  }, [params.id]);

  if (err) return <p role="alert" className="text-red-700">{err}</p>;
  if (!r) return <p className="text-ink-soft">Memuat hasil…</p>;
  const TARGET = 550; // TODO: ambil dari profil (users.targetScore)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand">HASIL {r.kind === "trial" ? "FREE TRIAL" : "TES"}</p>
        <h1 className="font-display text-3xl font-extrabold text-navy">{r.testName}</h1>
        {r.durationSec != null && <p className="text-sm text-ink-soft">Selesai dalam {Math.floor(r.durationSec / 60)} menit {r.durationSec % 60} detik</p>}
      </div>

      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-ink-soft">Estimasi skor TOEFL ITP</p>
        <p className="font-display text-5xl font-extrabold text-navy">{r.scoreRange ? `${r.scoreRange[0]}–${r.scoreRange[1]}` : r.scoreEst}</p>
        <p className="mt-1 text-sm text-ink-soft">{Math.max(0, TARGET - r.scoreEst)} poin di bawah target {TARGET}</p>
        <div className="relative mt-4 h-2 rounded-full bg-canvas" aria-hidden>
          <div className="absolute h-2 rounded-full bg-brand" style={{ width: `${((r.scoreEst - 310) / (677 - 310)) * 100}%` }} />
          <div className="absolute -top-1 h-4 w-0.5 bg-accent" style={{ left: `${((TARGET - 310) / (677 - 310)) * 100}%` }} />
        </div>
        <p className="mt-4 rounded-lg bg-accent-tint p-3 text-xs text-accent-dark">Estimasi dari tes simulasi, bukan skor resmi. Skor resmi hanya dari tes TOEFL ITP yang diselenggarakan pihak resmi.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {r.sectionScores.map((s) => (
          <div key={s.section} className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-ink-soft">{LABEL[s.section]}</p>
            <p className="font-display text-3xl font-extrabold text-navy">{s.scaled}</p>
            <p className="text-sm text-ink-soft">{s.raw} dari {s.total} benar</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-lg font-extrabold text-navy">Pembahasan soal</h2>
        <p className="text-sm text-ink-soft">{r.review.filter((x) => !x.locked).length} terbuka · {r.review.filter((x) => x.locked).length} terkunci</p>
        <ul className="mt-4 flex flex-col gap-3">
          {r.review.map((x) => (
            <li key={x.no} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-navy">Soal {x.no} · {LABEL[x.section]} · {x.type}</span>
                <span className={x.correct ? "font-semibold text-success" : "font-semibold text-red-700"}>{x.correct ? "Benar" : x.answered ? "Salah" : "Tidak dijawab"}</span>
              </div>
              {x.locked ? <p className="mt-1 text-xs text-ink-soft">🔒 Pembahasan terkunci</p> : (
                <div className="mt-2 text-sm">
                  <p>{x.stem}</p>
                  <p className="mt-1 text-ink-soft">Jawabanmu: {x.yourChoice != null ? x.options?.[x.yourChoice] : "—"} · Benar: <b>{x.options?.[x.answerKey!]}</b></p>
                  {x.explanation && <p className="mt-1">{x.explanation}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <Link href="/tes" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">Kembali ke Tes Saya</Link>
        <Link href="/paket" className="rounded-xl border border-line-strong px-5 py-2.5 text-sm font-semibold text-navy">Lihat paket</Link>
      </div>
    </div>
  );
}
