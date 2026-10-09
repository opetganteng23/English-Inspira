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
      <div><h1 className="page-title">Coaching Monitor</h1><p className="text-sm text-ink-soft">Makes sure participants’ quotas can be used up before the contract ends, and monitors attendance per institution.</p></div>
      <ErrorNote text={error} />
      {data?.institutions.length === 0 && <Empty>No active institutions yet.</Empty>}
      <div className="table-wrap"><table>
        <thead><tr><th>Institution</th><th>Coach</th><th>Active participants</th><th>Quota left</th><th>Open slot seats</th><th>Present</th><th>Warnings</th></tr></thead>
        <tbody>
          {data?.institutions.map((i) => (
            <tr key={i.id}>
              <td className="font-semibold text-navy">{i.name}<br /><span className="text-xs font-normal text-ink-soft">{i.contractEnd ? `contract until ${tgl(i.contractEnd)}` : "no limit"}</span></td>
              <td>{i.coaches}</td><td>{i.participants}</td><td>{i.quotaRemaining}</td><td>{i.openSeats}</td>
              <td>{i.presentPct != null ? `${i.presentPct}% (${i.sessionsMarked} sessions, ${i.absent} absent)` : "-"}</td>
              <td>{i.warnings.length ? <ul className="list-disc pl-4 text-xs text-red-700">{i.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <span className="badge-ok">OK</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
