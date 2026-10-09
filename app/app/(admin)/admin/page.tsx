"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { HBars, Stat, Loading, ErrorNote } from "@/components/Charts";

type D = {
  days: number;
  kpi: { institutions: number; participants: number; active: number; invited: number; loggedInRecently: number; placementsDone: number; placementPct: number | null };
  levels: { name: string; n: number }[];
  tests: { kind: string; n: number }[];
  actions: { label: string; n: number; href: string }[];
  mail: { queued: number; failed: number };
  expiring: { name: string; contractEnd: string }[];
  upcoming: { id: string; title: string; date: string; place: string; registered: number; quota: number }[];
};
const KIND: Record<string, string> = { placement: "Placement", sim: "Simulasi", practice: "Latihan", quiz: "Kuis unit" };

export default function AdminHome() {
  const [days, setDays] = useState(30);
  const { data: d, loading, error } = useApi<D>(`/api/admin/dashboard?days=${days}`);
  const k = d?.kpi;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Ringkasan</h1><p className="text-sm text-ink-soft">Aktivitas {days} hari terakhir</p></div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm" role="tablist" aria-label="Rentang waktu">{[7, 30, 90].map((n) => <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)} className={`rounded-md px-3 py-1.5 font-semibold ${days === n ? "bg-navy text-white" : "text-ink-soft"}`}>{n} hari</button>)}</div>
      </div>
      <ErrorNote text={error} />
      {loading && !d ? <Loading /> : d && k && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="INSTITUSI AKTIF" value={k.institutions} />
            <Stat label="PESERTA" value={k.participants} sub={`${k.active} aktif · ${k.invited} menunggu aktivasi`} tone={k.invited > k.active ? "warn" : undefined} />
            <Stat label="LOGIN TERAKHIR" value={k.loggedInRecently} sub={`peserta dalam ${d.days} hari`} />
            <Stat label="PLACEMENT SELESAI" value={k.placementsDone} sub={k.placementPct != null ? `${k.placementPct}% dari peserta aktif` : undefined} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Sebaran level peserta</h2><div className="mt-4"><HBars rows={d.levels.map((l) => ({ label: l.name, value: l.n, sub: "peserta" }))} /></div></section>
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Tes selesai ({d.days} hari)</h2>
              <div className="mt-4">{d.tests.length ? <HBars color="#F08A1C" rows={d.tests.map((t) => ({ label: KIND[t.kind] ?? t.kind, value: t.n, sub: "tes" }))} /> : <p className="text-sm text-ink-soft">Belum ada tes selesai.</p>}</div></section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Perlu tindakan</h2>
              <ul className="mt-3 flex flex-col divide-y divide-line">{d.actions.map((a) => <li key={a.label} className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{a.label}</span><span className="flex items-center gap-3"><span className={a.n ? "badge-warn" : "badge-ok"}>{a.n}</span><Link href={a.href} className="text-sm font-semibold text-brand">Buka →</Link></span></li>)}</ul>
              <p className="mt-2 text-xs text-ink-soft">Antrean email: {d.mail.queued} menunggu, {d.mail.failed} gagal.</p></section>
            <section className="card"><div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Sesi ITP mendatang</h2><Link href="/admin/jadwal-itp" className="text-sm font-semibold text-brand">Kelola jadwal →</Link></div>
              {d.upcoming.length ? <ul className="mt-3 flex flex-col gap-3">{d.upcoming.map((s) => <li key={s.id}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-navy">{s.title} · {tgl(s.date)}</span><span>{s.registered}/{s.quota}</span></div><div className="mt-1 h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (s.registered / Math.max(1, s.quota)) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-3 text-sm text-ink-soft">Belum ada sesi mendatang.</p>}
              {d.expiring.length > 0 && <div className="mt-4 border-t border-line pt-3"><p className="text-sm font-semibold text-navy">Kontrak segera berakhir</p><ul className="mt-1 text-sm text-ink-soft">{d.expiring.map((i) => <li key={i.name}>{i.name} · {tgl(i.contractEnd)}</li>)}</ul></div>}</section>
          </div>
        </>
      )}
    </div>
  );
}
