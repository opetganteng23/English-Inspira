"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type C = { id: string; type: "itp" | "sim_report"; number: string; issuedAt: string; data: { name?: string; testName?: string; scores?: { listening?: number; structure?: number; reading?: number; total?: number } }; verifyUrl: string };

export default function Sertifikat() {
  const { data, loading, error } = useApi<{ certificates: C[] }>("/api/certificates");
  const [copied, setCopied] = useState("");
  if (loading) return <Loading />;
  const list = data?.certificates ?? [];
  const itp = list.filter((c) => c.type === "itp"), reports = list.filter((c) => c.type === "sim_report");

  async function copy(c: C) {
    try { await navigator.clipboard.writeText(`${location.origin}${c.verifyUrl}`); setCopied(c.id); setTimeout(() => setCopied(""), 2500); } catch { /* clipboard tidak tersedia */ }
  }
  const Card = ({ c }: { c: C }) => (
    <div className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2"><span className={c.type === "itp" ? "badge-ok" : "badge-muted"}>{c.type === "itp" ? "Sertifikat resmi" : "Laporan hasil tes"}</span><span className="text-xs text-ink-soft">{c.number}</span></div>
      <h2 className="font-display text-lg font-extrabold text-navy">{c.type === "itp" ? "TOEFL ITP" : c.data.testName ?? "Tes Simulasi"}</h2>
      <p className="text-sm text-ink-soft">Terbit {tgl(c.issuedAt)} · skor total <b className="text-navy">{c.data.scores?.total ?? "–"}</b></p>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">{[["Listening", c.data.scores?.listening], ["Structure", c.data.scores?.structure], ["Reading", c.data.scores?.reading]].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-canvas p-2"><p className="text-xs text-ink-soft">{k}</p><b className="text-navy">{v ?? "–"}</b></div>)}</div>
      <div className="flex flex-col gap-2 sm:flex-row"><a className="btn-solid" href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noreferrer">Unduh PDF</a><button className="btn-outline" onClick={() => copy(c)}>{copied === c.id ? "Tersalin ✓" : "Salin link verifikasi"}</button></div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="page-title">Sertifikat</h1><p className="mt-1 text-ink-soft">Sertifikat TOEFL ITP resmi dan laporan hasil tes simulasi.</p></div>
      <ErrorNote text={error} />
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold text-navy">Sertifikat TOEFL ITP resmi</h2>
        {itp.length ? <div className="grid gap-4 md:grid-cols-2">{itp.map((c) => <Card key={c.id} c={c} />)}</div> : (
          <div className="card"><p className="text-sm text-ink-soft">Belum ada sertifikat. Sertifikat tampil di sini setelah skor resmi diinput admin.</p><Link href="/itp" className="btn-outline mt-3">Lihat pendaftaran ITP</Link></div>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold text-navy">Laporan hasil tes simulasi</h2>
        <p className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">Laporan tes simulasi adalah bukti latihan, bukan sertifikat TOEFL resmi.</p>
        {reports.length ? <div className="grid gap-4 md:grid-cols-2">{reports.map((c) => <Card key={c.id} c={c} />)}</div> : <p className="text-sm text-ink-soft">Laporan dibuat otomatis setiap kali kamu menyelesaikan Tes Simulasi, Diagnostic, atau Prediction.</p>}
      </section>
    </div>
  );
}
