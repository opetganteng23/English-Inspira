"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type P = { id: string; name: string | null; email: string; status: string; level: string | null; scoreEst: number | null; quota: { used: number; total: number } | null; lastAt: string | null };

export default function CoachHome() {
  const [q, setQ] = useState("");
  const { data, loading, error } = useApi<{ participants: P[] }>(`/api/coach/participants${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Peserta saya</h1><p className="text-sm text-ink-soft">Peserta di institusimu beserta level, skor, dan sisa kuota coaching. Jadwal sesi dan catatan ada di tahap berikutnya.</p></div>
      <input className="field max-w-xs" placeholder="Cari nama atau email" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : data?.participants.length === 0 ? <Empty>Belum ada peserta.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Peserta</th><th>Level</th><th>Skor</th><th>Kuota</th><th>Tes terakhir</th></tr></thead>
          <tbody>{data?.participants.map((p) => (
            <tr key={p.id}><td className="font-semibold text-navy">{p.name ?? "(belum ada nama)"}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.status === "invited" ? " · menunggu aktivasi" : ""}</span></td>
              <td>{p.level ?? "–"}</td><td>{p.scoreEst ?? "–"}</td><td>{p.quota ? `${p.quota.total - p.quota.used} / ${p.quota.total}` : "–"}</td><td>{p.lastAt ? tgl(p.lastAt) : "–"}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
