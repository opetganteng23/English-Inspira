"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { HBars, Stat, Loading, ErrorNote } from "@/components/Charts";

type S = {
  institution: { name: string; batch: string | null; contractEnd: string | null; seats: number };
  registered: number; seats: number; seatsLeft: number; active: number; invited: number; placementDone: number; placementPct: number | null;
  levels: { label: string; n: number }[]; avgEstimate: number | null; avgDelta: number | null; reachedPct: number | null; reached: number; withScore: number;
  coaching: { sessionsMarked: number; presentPct: number | null; absent: number; quotaUsedPct: number | null };
  planLatePct: number | null; planLate: number; commonWeaknesses: { title: string; n: number }[];
  attention: { id: string; name: string; reason: string; score: number | null }[];
};

export default function InstHome() {
  const { url, ready } = useInstQuery();
  const { data: s, loading, error } = useApi<S>(url("/api/inst/summary"));
  if (!ready || loading) return <Loading />;
  if (!s) return <ErrorNote text={error || "Pilih institusi lewat menu admin."} />;
  const withQ = (p: string) => url(p) ?? p;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-wider text-brand">{s.institution.batch ?? "PORTAL INSTITUSI"}</p><h1 className="page-title">{s.institution.name}</h1><p className="text-sm text-ink-soft">Ringkasan kelompok (agregat). Isi analisis dan catatan coach per orang tidak ditampilkan di portal ini.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><a className="btn-outline" href={url("/api/inst/report.xlsx") ?? "#"}>Unduh laporan (Excel)</a><Link className="btn-solid" href={withQ("/institusi/peserta")}>Tambah peserta</Link></div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="PESERTA" value={<>{s.registered}<span className="text-lg text-ink-soft"> / {s.seats}</span></>} sub={`${s.active} aktif · ${s.invited} menunggu aktivasi`} />
        <Stat label="PLACEMENT SELESAI" value={s.placementPct != null ? `${s.placementPct}%` : "–"} sub={`${s.placementDone} dari ${s.registered} peserta`} />
        <Stat label="RATA-RATA ESTIMASI" value={s.avgEstimate ?? "–"} sub={s.avgDelta != null ? `${s.avgDelta >= 0 ? "+" : ""}${s.avgDelta} dari tes pertama` : "Belum ada pembanding"} tone={s.avgDelta != null && s.avgDelta >= 0 ? "ok" : undefined} />
        <Stat label="MENCAPAI TARGET" value={s.reachedPct != null ? `${s.reachedPct}%` : "–"} sub={`${s.reached} dari ${s.withScore} peserta bernilai`} />
        <Stat label="KEHADIRAN COACHING" value={s.coaching.presentPct != null ? `${s.coaching.presentPct}%` : "–"} sub={`${s.coaching.sessionsMarked} sesi tercatat · ${s.coaching.absent} tidak hadir`} />
        <Stat label="KUOTA COACHING TERPAKAI" value={s.coaching.quotaUsedPct != null ? `${s.coaching.quotaUsedPct}%` : "–"} />
        <Stat label="RENCANA TERLAMBAT" value={s.planLate} sub={s.planLatePct != null ? `${s.planLatePct}% peserta aktif` : undefined} tone={s.planLate ? "warn" : undefined} />
        <Stat label="KONTRAK BERAKHIR" value={s.institution.contractEnd ? new Date(s.institution.contractEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "–"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Sebaran level</h2><div className="mt-4"><HBars rows={s.levels.map((d) => ({ label: d.label, value: d.n, sub: "peserta" }))} /></div></section>
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Topik yang paling banyak lemah</h2><p className="text-sm text-ink-soft">Bahan untuk kelas tatap muka atau pelatihan internal. Hanya agregat kelompok.</p><div className="mt-4"><HBars color="#F08A1C" rows={s.commonWeaknesses.map((w) => ({ label: w.title, value: w.n, sub: "peserta" }))} /></div></section>
      </div>

      <section className="card"><div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Peserta yang perlu perhatian</h2><Link href={withQ("/institusi/peserta")} className="text-sm font-semibold text-brand">Lihat semua peserta →</Link></div>
        {s.attention.length ? <div className="table-wrap mt-3 !border-0"><table><thead><tr><th>Peserta</th><th>Alasan</th><th>Skor</th></tr></thead><tbody>{s.attention.map((a) => <tr key={a.id}><td className="font-semibold text-navy">{a.name}</td><td>{a.reason}</td><td>{a.score ?? "–"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-ink-soft">Tidak ada peserta yang perlu perhatian.</p>}</section>
    </div>
  );
}
