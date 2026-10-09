"use client";

import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type I = { id: string; name: string; contractEnd: string | null; coaches: number; participants: number; quotaRemaining: number; openSeats: number; sessionsMarked: number; presentPct: number | null; absent: number; warnings: string[] };

export default function PantauanCoaching() {
  const { data, loading, error } = useApi<{ institutions: I[] }>("/api/admin/coaching");
  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Pantauan Coaching</h1><p className="text-sm text-ink-soft">Memastikan kuota peserta mungkin habis sebelum kontrak berakhir, dan memantau kehadiran per institusi.</p></div>
      <ErrorNote text={error} />
      {data?.institutions.length === 0 && <Empty>Belum ada institusi aktif.</Empty>}
      <div className="table-wrap"><table>
        <thead><tr><th>Institusi</th><th>Coach</th><th>Peserta aktif</th><th>Sisa kuota</th><th>Kursi slot terbuka</th><th>Hadir</th><th>Peringatan</th></tr></thead>
        <tbody>
          {data?.institutions.map((i) => (
            <tr key={i.id}>
              <td className="font-semibold text-navy">{i.name}<br /><span className="text-xs font-normal text-ink-soft">{i.contractEnd ? `kontrak s/d ${tgl(i.contractEnd)}` : "tanpa batas"}</span></td>
              <td>{i.coaches}</td><td>{i.participants}</td><td>{i.quotaRemaining}</td><td>{i.openSeats}</td>
              <td>{i.presentPct != null ? `${i.presentPct}% (${i.sessionsMarked} sesi, ${i.absent} absen)` : "–"}</td>
              <td>{i.warnings.length ? <ul className="list-disc pl-4 text-xs text-red-700">{i.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <span className="badge-ok">Aman</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
