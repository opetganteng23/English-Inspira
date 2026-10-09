"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, HBars } from "@/components/Charts";

type Sec = { section: string; raw: number; total: number; scaled: number };
type Rev = { no: number; section: string; type: string; groupId: string | null; correct: boolean; answered: boolean; stem?: string; options?: string[]; yourChoice?: number | null; answerKey?: number; explanation?: string };
type Topic = { skill: string; topic: string; correct: number; total: number; score: number };
type Analysis = { status: "pending" | "ready" | "failed"; summary?: string; weaknesses?: { title: string; detail: string }[]; gapToTarget?: { target: number; estimated: number; gap: number }; nextSteps?: string[]; mock?: boolean; error?: string };
type R = { kind: string; testName: string; attemptId: string; durationSec: number | null; scoreEst: number; sectionScores: Sec[]; topicScores: Topic[]; flags: number; analysis: Analysis; review: Rev[]; level: { name: string; quota: number; scoreMin: number; scoreMax: number } | null; transcripts: { groupId: string; title: string; text: string }[] };

const KIND: Record<string, string> = { placement: "PLACEMENT TEST", sim: "TES SIMULASI", practice: "LATIHAN" };
const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

export default function Hasil({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  const me = useApi<{ targetScore: number | null }>("/api/me");
  const [filter, setFilter] = useState<"all" | "wrong">("wrong");

  useEffect(() => {
    let stop = false, tries = 0;
    const load = async () => {
      try {
        const d: R = await api(`/api/attempts/${params.id}/result`);
        if (stop) return;
        setR(d);
        // Analisis AI berjalan async: cek ulang sampai siap (maks ±1 menit).
        if (d.analysis.status === "pending" && tries++ < 20) setTimeout(load, 3000);
      } catch (e) { if (!stop) setErr((e as Error).message); }
    };
    load();
    return () => { stop = true; };
  }, [params.id]);

  async function askCounselor() {
    try { const d = await api("/api/counselor/threads", { json: { attemptId: params.id } }); router.push(`/konselor?thread=${d.id}`); }
    catch (e) { setErr((e as Error).message); }
  }
  async function retry() {
    try { await api(`/api/attempts/${params.id}/analysis`, { json: {} }); setR((x) => x && { ...x, analysis: { status: "pending" } }); setTimeout(() => location.reload(), 4000); } catch (e) { setErr((e as Error).message); }
  }

  if (err && !r) return <ErrorNote text={err} />;
  if (!r) return <Loading text="Memuat hasil…" />;
  const target = me.data?.targetScore ?? null;
  const a = r.analysis;
  const shown = r.review.filter((x) => (filter === "wrong" ? !x.correct : true));
  const weakTopics = [...(r.topicScores ?? [])].sort((x, y) => x.score - y.score).slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand">HASIL {KIND[r.kind] ?? "TES"}</p>
        <h1 className="page-title">{r.testName}</h1>
        {r.durationSec != null && <p className="text-sm text-ink-soft">Selesai dalam {Math.floor(r.durationSec / 60)} menit {r.durationSec % 60} detik{r.flags ? ` · ${r.flags} catatan aktivitas tes` : " · sesi bersih"}</p>}
      </div>
      <ErrorNote text={err} />

      <section className="card">
        <p className="text-sm text-ink-soft">Estimasi skor TOEFL ITP</p>
        <p className="font-display text-5xl font-extrabold text-navy sm:text-6xl">{r.scoreEst}</p>
        {target && <p className="mt-1 text-sm text-ink-soft">{r.scoreEst >= target ? `Sudah mencapai target ${target}` : `${target - r.scoreEst} poin di bawah target ${target}`}</p>}
        <div className="relative mt-5 h-2.5 rounded-full bg-canvas" aria-hidden>
          <div className="absolute h-2.5 rounded-full bg-brand" style={{ width: `${((r.scoreEst - 310) / (677 - 310)) * 100}%` }} />
          {target && <div className="absolute -top-1.5 h-5 w-0.5 bg-accent" style={{ left: `${((target - 310) / (677 - 310)) * 100}%` }} />}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-soft"><span>310</span><span>677</span></div>
        <p className="mt-4 rounded-lg bg-accent-tint p-3 text-xs text-accent-dark">Estimasi dari tes simulasi, bukan skor resmi. Skor resmi hanya dari tes TOEFL ITP yang diselenggarakan pihak resmi.</p>
      </section>

      {r.level && (
        <section className="card border-brand bg-brand-tint">
          <p className="text-xs font-semibold tracking-wider text-brand">LEVELMU</p>
          <p className="font-display text-3xl font-extrabold text-navy">{r.level.name}</p>
          <p className="text-sm text-ink-soft">Rentang skor {r.level.scoreMin}–{r.level.scoreMax} · jatah coaching {r.level.quota} sesi. Levelmu menentukan materi dan tes yang terbuka.</p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card"><h2 className="font-display text-lg font-extrabold text-navy">Skor per section</h2>
          <div className="mt-4"><HBars max={68} rows={r.sectionScores.map((s) => ({ label: LABEL[s.section], value: s.scaled, sub: `${s.raw}/${s.total} benar` }))} /></div>
          <p className="mt-2 text-xs text-ink-soft">Skala 31–68 per section.</p></div>

        <div className="card">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Analisis AI</h2>{a.status === "ready" && a.mock && <span className="badge-muted">analisis otomatis dasar</span>}</div>
          {a.status === "pending" && <p className="mt-3 text-sm text-ink-soft" role="status">Menyusun analisis… biasanya kurang dari satu menit.</p>}
          {a.status === "failed" && <div className="mt-3 text-sm"><p className="text-red-700">{a.error ?? "Analisis belum tersedia."}</p><button className="btn-outline mt-2" onClick={retry}>Coba lagi</button></div>}
          {a.status === "ready" && (
            <div className="mt-3 flex flex-col gap-3 text-sm">
              <p className="leading-relaxed">{a.summary}</p>
              {!!a.weaknesses?.length && <div><p className="font-semibold text-navy">Yang perlu diperkuat</p><ul className="mt-1 flex flex-col gap-2">{a.weaknesses.map((w) => <li key={w.title} className="rounded-lg bg-canvas p-3"><b className="text-navy">{w.title}</b><br /><span className="text-ink-soft">{w.detail}</span></li>)}</ul></div>}
              {!!a.nextSteps?.length && <div><p className="font-semibold text-navy">Langkah berikutnya</p><ol className="mt-1 list-decimal pl-5 text-ink-soft">{a.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol></div>}
            </div>
          )}
        </div>
      </section>

      {weakTopics.length > 0 && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Skor per topik</h2>
          <p className="text-sm text-ink-soft">Terendah lebih dulu. Topik dengan sedikit soal belum cukup untuk disimpulkan.</p>
          <div className="mt-4"><HBars max={100} unit="%" rows={weakTopics.map((t) => ({ label: `${t.topic} (${LABEL[t.skill] ?? t.skill})`, value: Math.round(t.score), sub: `${t.correct}/${t.total}` }))} /></div>
        </section>
      )}

      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-lg font-extrabold text-navy">Tanya Konselor AI tentang hasilmu</h2><p className="text-sm text-ink-soft">Konselor sudah membaca hasil ini dan semua jawabanmu.</p></div>
        <button className="btn-solid shrink-0" onClick={askCounselor}>Tanya konselor</button>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-display text-lg font-extrabold text-navy">Pembahasan soal</h2><p className="text-sm text-ink-soft">{r.review.length} soal · {r.review.filter((x) => x.correct).length} benar</p></div>
          <div className="flex gap-1 rounded-lg bg-canvas p-1 text-sm" role="tablist">
            {(["wrong", "all"] as const).map((f) => <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 font-semibold ${filter === f ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{f === "wrong" ? "Yang salah" : "Semua"}</button>)}
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((x) => (
            <li key={x.no} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-navy">Soal {x.no} · {LABEL[x.section]} · {x.type}</span><span className={x.correct ? "badge-ok" : "badge-bad"}>{x.correct ? "Benar" : x.answered ? "Salah" : "Tidak dijawab"}</span></div>
              <div className="mt-2 text-sm"><p>{x.stem}</p><p className="mt-1 text-ink-soft">Jawabanmu: {x.yourChoice != null ? x.options?.[x.yourChoice] : "—"} · Benar: <b className="text-navy">{x.options?.[x.answerKey!]}</b></p>{x.explanation && <p className="mt-1">{x.explanation}</p>}
                {x.groupId && r.transcripts.some((t) => t.groupId === x.groupId) && (
                  <details className="mt-2 rounded-lg bg-canvas p-3"><summary className="cursor-pointer font-semibold text-navy">Transkrip audio</summary><p className="mt-2 whitespace-pre-wrap text-ink-soft">{r.transcripts.find((t) => t.groupId === x.groupId)!.text}</p></details>
                )}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="text-sm text-ink-soft">Tidak ada soal untuk ditampilkan.</li>}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/tes" className="btn-solid">Kembali ke Tes Saya</Link>
        <Link href="/hasil" className="btn-outline">Semua hasil</Link>
      </div>
    </div>
  );
}
