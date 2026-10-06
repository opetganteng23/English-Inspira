"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, rupiah, tgl } from "@/lib/client";
import { LineChart, Loading, ErrorNote } from "@/components/Charts";
import { useState } from "react";

type Home = {
  name: string | null; target: number | null; goal: string | null;
  progress: { id: string; name: string; score: number; at: string }[];
  last: { id: string; name: string; score: number; delta: number | null; sections: { section: string; scaled: number }[] } | null;
  next: { title: string; body: string; cta: string; href: string } | null;
  suggestion: { title: string; body: string; product: { name: string; price: number } | null } | null;
  access: { tests: Record<string, number>; itp: number; materials: boolean; counselor: { allowed: boolean; mode: string; remaining: number | null; expiresAt: string | null }; products: { slug: string; name: string }[] };
  plan: { id: string; text: string; done: boolean }[];
};
const GOAL: Record<string, string> = { kelulusan: "Syarat kelulusan", beasiswa: "Beasiswa / S2", pekerjaan: "Pekerjaan / CPNS", lainnya: "Lainnya" };
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const KIND: Record<string, string> = { sim: "Tes Simulasi", diagnostic: "Diagnostic", prediction: "Prediction" };

export default function Beranda() {
  const { data: h, error, loading, setData } = useApi<Home>("/api/home");
  const [err, setErr] = useState("");

  async function toggle(id: string, done: boolean) {
    setData((d) => d && { ...d, plan: d.plan.map((p) => (p.id === id ? { ...p, done } : p)) });
    try { await api(`/api/counselor/plan/${id}`, { method: "PATCH", json: { done } }); }
    catch (e) { setErr((e as Error).message); setData((d) => d && { ...d, plan: d.plan.map((p) => (p.id === id ? { ...p, done: !done } : p)) }); }
  }

  if (loading) return <Loading />;
  if (!h) return <ErrorNote text={error} />;
  const owned = [
    ...Object.entries(h.access.tests).filter(([, n]) => n > 0).map(([k, n]) => `${KIND[k] ?? k}: ${n} tersisa`),
    ...(h.access.itp > 0 ? [`Pendaftaran ITP resmi: ${h.access.itp}`] : []),
    ...(h.access.counselor.mode === "paid" ? [`Konselor AI${h.access.counselor.expiresAt ? ` s/d ${tgl(h.access.counselor.expiresAt)}` : " (tanpa batas waktu)"}`] : h.access.counselor.mode === "free" ? [`Konselor AI gratis: ${h.access.counselor.remaining} pertanyaan`] : []),
    ...(h.access.materials ? ["Materi lengkap"] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Halo, {h.name ?? "peserta"}</h1>
        <p className="mt-1 text-ink-soft">{h.target ? `Target skor ITP: ${h.target}` : <Link href="/profil" className="font-semibold text-brand">Atur target skormu →</Link>}{h.goal ? ` · Tujuan: ${GOAL[h.goal]}` : ""}</p>
      </div>
      <ErrorNote text={err} />

      {h.next && (
        <section className="rounded-2xl bg-navy p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">LANGKAH BERIKUTNYA</p>
          <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{h.next.title}</h2>
          <p className="mt-1 text-mist">{h.next.body}</p>
          <Link href={h.next.href} className="btn-accent mt-4">{h.next.cta}</Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Perkembangan skor</h2>{h.last && <Link href={`/hasil/${h.last.id}`} className="text-sm font-semibold text-brand">Lihat laporan lengkap →</Link>}</div>
          <LineChart points={h.progress.map((p) => ({ label: p.name, value: p.score }))} target={h.target} />
          {h.last && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-brand-tint p-3"><p className="text-xs text-ink-soft">Hasil terakhir</p><p className="font-display text-2xl font-extrabold text-navy">{h.last.score}</p>{h.last.delta != null && <p className={`text-xs font-semibold ${h.last.delta >= 0 ? "text-success" : "text-red-700"}`}>{h.last.delta >= 0 ? "+" : ""}{h.last.delta} dari tes sebelumnya</p>}</div>
              {h.last.sections.map((s) => <div key={s.section} className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">{SEC[s.section ?? ""] ?? s.section}</p><p className="font-display text-2xl font-extrabold text-navy">{s.scaled}</p></div>)}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Produk aktif</h2>
          {owned.length ? <ul className="mt-3 flex flex-col gap-2 text-sm">{owned.map((o) => <li key={o} className="flex gap-2"><span className="text-success">✓</span>{o}</li>)}</ul> : <p className="mt-3 text-sm text-ink-soft">Belum ada paket aktif.</p>}
          <Link href="/paket" className="mt-4 inline-block text-sm font-semibold text-brand">Lihat semua paket →</Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Rencana aksi</h2>
          <p className="text-sm text-ink-soft">Dari Konselor AI</p>
          {h.plan.length ? (
            <ul className="mt-3 flex flex-col gap-1">
              {h.plan.map((p) => (
                <li key={p.id}><label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-canvas"><input type="checkbox" className="mt-1 h-5 w-5" checked={p.done} onChange={(e) => toggle(p.id, e.target.checked)} /><span className={p.done ? "text-ink-soft line-through" : ""}>{p.text}</span></label></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-soft">Belum ada rencana aksi. Tanya Konselor AI untuk menyusunnya.</p>}
          <Link href="/konselor" className="mt-4 inline-block text-sm font-semibold text-brand">Tanya Konselor AI →</Link>
        </section>

        {h.suggestion ? (
          <section className="card border-accent bg-accent-tint">
            <p className="text-xs font-semibold tracking-wider text-accent-dark">DISARANKAN</p>
            <h2 className="mt-1 font-display text-lg font-extrabold text-navy">{h.suggestion.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{h.suggestion.body}</p>
            <Link href="/paket" className="btn-accent mt-4">{h.suggestion.product ? `${h.suggestion.product.name} · ${rupiah(h.suggestion.product.price)}` : "Lihat paket"}</Link>
          </section>
        ) : (
          <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Materi belajar</h2><p className="mt-1 text-sm text-ink-soft">Latihan interaktif dan materi untuk memperkuat kelemahanmu.</p><Link href="/materi" className="btn-outline mt-4">Buka materi</Link></section>
        )}
      </div>
    </div>
  );
}
