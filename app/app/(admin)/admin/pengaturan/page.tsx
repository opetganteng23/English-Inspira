"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type G = { siteName: string; supportEmail: string; supportWhatsapp: string; itpOrganizer: string; refundPolicy: string; rescheduleDays: number; idRetentionDays: number };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function Pengaturan() {
  const { data, loading, error, reload } = useApi<G>("/api/admin/settings/general");
  const [v, setV] = useState<G | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(data); }, [data]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!v) return;
    setBusy(true); setMsg(null);
    try { await api("/api/admin/settings/general", { method: "PUT", json: { ...v, rescheduleDays: Number(v.rescheduleDays), idRetentionDays: Number(v.idRetentionDays) } }); setMsg({ ok: true, text: "Pengaturan disimpan." }); reload(); }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }
  if (loading && !v) return <Loading />;
  if (!v) return <ErrorNote text={error} />;
  const set = <K extends keyof G>(k: K, val: G[K]) => setV({ ...v, [k]: val });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div><h1 className="page-title">Pengaturan</h1><p className="text-sm text-ink-soft">Kontak bantuan dan informasi tes resmi. Angka level dan kuota ada di Parameter Sistem.</p></div>
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <form onSubmit={save} className="card flex flex-col gap-4">
        <label className={label}>Nama produk<input className="field font-normal" value={v.siteName} onChange={(e) => set("siteName", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Email bantuan<input className="field font-normal" type="email" value={v.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></label>
          <label className={label}>WhatsApp bantuan<input className="field font-normal" inputMode="tel" value={v.supportWhatsapp} onChange={(e) => set("supportWhatsapp", e.target.value)} placeholder="6281234567890" /></label>
        </div>
        <label className={label}>Nama mitra penyelenggara tes resmi<input className="field font-normal" value={v.itpOrganizer} onChange={(e) => set("itpOrganizer", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Batas ubah jadwal ITP (hari sebelum tes)<input className="field font-normal" type="number" min={0} max={60} value={v.rescheduleDays} onChange={(e) => set("rescheduleDays", Number(e.target.value))} /></label>
          <label className={label}>Retensi dokumen identitas (hari)<input className="field font-normal" type="number" min={1} value={v.idRetentionDays} onChange={(e) => set("idRetentionDays", Number(e.target.value))} /></label>
        </div>
        <label className={label}>Teks kebijakan perubahan jadwal ITP (opsional)<textarea className="field font-normal" rows={4} value={v.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} placeholder="Kosongkan untuk memakai teks bawaan." /></label>
        <button className="btn-solid self-start" disabled={busy}>{busy ? "Menyimpan…" : "Simpan pengaturan"}</button>
      </form>
    </div>
  );
}
