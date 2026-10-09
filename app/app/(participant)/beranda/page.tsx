"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { LineChart, Loading, ErrorNote } from "@/components/Charts";

type Home = {
  name: string | null; institution: { name: string; contractEnd: string | null } | null;
  level: { name: string; scoreMin: number; scoreMax: number } | null; nextLevel: { name: string; scoreMin: number } | null;
  scoreEst: number | null; gapToNext: number | null;
  quota: { used: number; total: number; left: number } | null;
  counselor: { used: number; quota: number; remaining: number };
  step: { title: string; body: string; cta: string; href: string } | null;
  plan: { id: string; title: string; priority: "high" | "medium"; source: string; dueAt: string | null }[];
  weakTopics: { skill: string; topic: string; score: number; status: string }[];
  progress: { id: string; name: string; kind: string; score: number; at: string }[];
  last: { id: string; name: string; score: number; delta: number | null; sections: { section: string; scaled: number }[] } | null;
};
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

export default function Beranda() {
  const { data: h, error, loading, reload } = useApi<Home>("/api/home");
  const [err, setErr] = useState("");
  async function done(id: string) {
    setErr("");
    try { await api(`/api/study-plan/${id}`, { method: "PATCH", json: { done: true } }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  if (loading) return <Loading />;
  if (!h) return <ErrorNote text={error} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Halo, {h.name ?? "peserta"}</h1>
        <p className="mt-1 text-ink-soft">{h.institution ? `${h.institution.name}${h.institution.contractEnd ? ` · akses sampai ${tgl(h.institution.contractEnd)}` : ""}` : "Program Edulyfe EPTA"}</p>
      </div>

      {h.step && (
        <section className="rounded-2xl bg-navy p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">LANGKAH BERIKUTNYA</p>
          <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{h.step.title}</h2>
          <p className="mt-1 text-mist">{h.step.body}</p>
          <Link href={h.step.href} className="btn-accent mt-4">{h.step.cta}</Link>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">LEVEL</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.level?.name ?? "–"}</p><p className="text-xs text-ink-soft">{h.level ? `Rentang ${h.level.scoreMin}–${h.level.scoreMax}` : "Ditentukan placement test"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">ESTIMASI SKOR</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.scoreEst ?? "–"}</p><p className="text-xs text-ink-soft">{h.nextLevel && h.gapToNext != null ? (h.gapToNext > 0 ? `${h.gapToNext} poin lagi ke ${h.nextLevel.name}` : `Sudah di batas ${h.nextLevel.name}`) : "Skala 310–677"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">KUOTA COACHING</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.quota ? `${h.quota.left}` : "–"}<span className="text-base text-ink-soft">{h.quota ? ` / ${h.quota.total}` : ""}</span></p><p className="text-xs text-ink-soft">{h.quota ? "sesi tersisa" : "Terbit setelah placement"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">KONSELOR AI</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.counselor.remaining}<span className="text-base text-ink-soft"> / {h.counselor.quota}</span></p><p className="text-xs text-ink-soft">pertanyaan bulan ini</p></div>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Perkembangan skor</h2>{h.last && <Link href={`/hasil/${h.last.id}`} className="text-sm font-semibold text-brand">Lihat laporan lengkap →</Link>}</div>
        <LineChart points={h.progress.map((p) => ({ label: p.name, value: p.score }))} />
        {h.last && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-brand-tint p-3"><p className="text-xs text-ink-soft">Hasil terakhir</p><p className="font-display text-2xl font-extrabold text-navy">{h.last.score}</p>{h.last.delta != null && <p className={`text-xs font-semibold ${h.last.delta >= 0 ? "text-success" : "text-red-700"}`}>{h.last.delta >= 0 ? "+" : ""}{h.last.delta} dari tes sebelumnya</p>}</div>
            {h.last.sections.map((s) => <div key={s.section} className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">{SEC[s.section] ?? s.section}</p><p className="font-display text-2xl font-extrabold text-navy">{s.scaled}</p></div>)}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Rencana belajar</h2>
        <p className="text-sm text-ink-soft">Dibuat otomatis dari topik yang perlu diperkuat, dengan batas waktu.</p>
        <ErrorNote text={err} />
        {h.plan.length ? (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {h.plan.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 flex-1 text-sm"><b className="text-navy">{p.title}</b><br /><span className="text-xs text-ink-soft">{p.priority === "high" ? "Prioritas tinggi" : "Prioritas sedang"}{p.dueAt ? ` · target ${tgl(p.dueAt)}` : ""}{p.source === "coach" ? " · dari coach" : ""}</span></span>
                <button className="btn-outline !min-h-[40px]" onClick={() => done(p.id)}>Tandai selesai</button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-ink-soft">{h.weakTopics.length ? "Belum ada item aktif." : "Belum ada topik lemah yang terdeteksi. Rencana muncul setelah ada cukup data dari tesmu."}</p>}
        {h.weakTopics.length > 0 && <p className="mt-3 text-xs text-ink-soft">Topik terlemah: {h.weakTopics.map((w) => `${w.topic} (${w.score}%)`).join(", ")}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Materi belajar</h2><p className="mt-1 text-sm text-ink-soft">Latihan interaktif dan materi untuk memperkuat kelemahanmu.</p><Link href="/materi" className="btn-outline mt-4">Buka materi</Link></section>
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Konselor AI</h2><p className="mt-1 text-sm text-ink-soft">Tanya strategi belajar berdasarkan hasil tesmu.</p><Link href="/konselor" className="btn-outline mt-4">Tanya Konselor AI</Link></section>
      </div>
    </div>
  );
}
