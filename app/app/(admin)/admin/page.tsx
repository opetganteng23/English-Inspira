"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { rupiah, tgl } from "@/lib/client";
import { HBars, Stat, Loading, ErrorNote } from "@/components/Charts";

type D = {
  days: number;
  kpi: { revenue: number; revenuePrev: number; revenueChangePct: number | null; paidOrders: number; createdOrders: number; trialCompleted: number; conversionPct: number | null; itpParticipants: number; itpUnscheduled: number };
  perProduct: { name: string; revenue: number; count: number }[];
  funnel: { label: string; n: number }[];
  actions: { label: string; n: number; href: string }[];
  upcoming: { id: string; title: string; date: string; place: string; registered: number; quota: number }[];
};

export default function AdminHome() {
  const [days, setDays] = useState(30);
  const { data: d, loading, error } = useApi<D>(`/api/admin/dashboard?days=${days}`);
  const k = d?.kpi;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Ringkasan</h1><p className="text-sm text-ink-soft">{days} hari terakhir</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg bg-white p-1 text-sm" role="tablist" aria-label="Rentang waktu">{[7, 30, 90].map((n) => <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)} className={`rounded-md px-3 py-1.5 font-semibold ${days === n ? "bg-navy text-white" : "text-ink-soft"}`}>{n} hari</button>)}</div>
          <a className="btn-outline !min-h-[40px]" href="/api/admin/orders/export.xlsx">Ekspor transaksi</a>
        </div>
      </div>
      <ErrorNote text={error} />
      {loading && !d ? <Loading /> : d && k && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="PENDAPATAN (LUNAS)" value={rupiah(k.revenue)} sub={k.revenueChangePct != null ? `${k.revenueChangePct >= 0 ? "+" : ""}${k.revenueChangePct}% dari periode sebelumnya` : "Belum ada pembanding"} tone={k.revenueChangePct != null && k.revenueChangePct < 0 ? "warn" : "ok"} />
            <Stat label="TRANSAKSI LUNAS" value={k.paidOrders} sub={`dari ${k.createdOrders} dibuat`} />
            <Stat label="FREE TRIAL SELESAI" value={k.trialCompleted} sub={k.conversionPct != null ? `konversi ke berbayar ${k.conversionPct}%` : "Belum ada data konversi"} />
            <Stat label="PESERTA ITP RESMI" value={k.itpParticipants} sub={`${k.itpUnscheduled} belum pilih jadwal`} tone={k.itpUnscheduled ? "warn" : undefined} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Penjualan per produk</h2><div className="mt-4"><HBars rows={d.perProduct.map((p) => ({ label: p.name, value: p.revenue, sub: `· ${p.count}×` }))} /></div></section>
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Funnel free trial → berbayar</h2><div className="mt-4"><HBars rows={d.funnel.map((f) => ({ label: f.label, value: f.n }))} color="#F08A1C" /></div></section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Perlu tindakan</h2>
              <ul className="mt-3 flex flex-col divide-y divide-line">{d.actions.map((a) => <li key={a.label} className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{a.label}</span><span className="flex items-center gap-3"><span className={a.n ? "badge-warn" : "badge-ok"}>{a.n}</span><Link href={a.href} className="text-sm font-semibold text-brand">Buka →</Link></span></li>)}</ul></section>
            <section className="card"><div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Sesi ITP mendatang</h2><Link href="/admin/jadwal-itp" className="text-sm font-semibold text-brand">Kelola jadwal →</Link></div>
              {d.upcoming.length ? <ul className="mt-3 flex flex-col gap-3">{d.upcoming.map((s) => <li key={s.id}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-navy">{s.title} · {tgl(s.date)}</span><span>{s.registered}/{s.quota}</span></div><div className="mt-1 h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (s.registered / s.quota) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-3 text-sm text-ink-soft">Belum ada sesi mendatang.</p>}</section>
          </div>
        </>
      )}
    </div>
  );
}
