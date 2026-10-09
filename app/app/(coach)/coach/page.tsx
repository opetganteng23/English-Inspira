"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type P = { id: string; name: string | null; email: string; status: string; level: string | null; scoreEst: number | null; quota: { used: number; total: number } | null; lastAt: string | null };

export default function CoachHome() {
  const [q, setQ] = useState("");
  const { data, loading, error } = useApi<{ participants: P[] }>(`/api/coach/participants${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">My participants</h1><p className="text-sm text-ink-soft">Participants in your institution with their level, score, and remaining coaching quota. Click a name for the pre-session report.</p></div>
      <input className="field max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : data?.participants.length === 0 ? <Empty>No participants yet.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Participant</th><th>Level</th><th>Score</th><th>Quota</th><th>Last test</th></tr></thead>
          <tbody>{data?.participants.map((p) => (
            <tr key={p.id}><td className="font-semibold text-navy"><Link className="text-brand" href={`/coach/participants/${p.id}`}>{p.name ?? "(no name yet)"}</Link><br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.status === "invited" ? " · awaiting activation" : ""}</span></td>
              <td>{p.level ?? "-"}</td><td>{p.scoreEst ?? "-"}</td><td>{p.quota ? `${p.quota.total - p.quota.used} / ${p.quota.total}` : "-"}</td><td>{p.lastAt ? tgl(p.lastAt) : "-"}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
