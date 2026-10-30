"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";
import { ScheduleBoard } from "@/components/ScheduleBoard";

type G = { id: string; name: string; kind: string };
type S = { id: string; title: string; date: string; place: string; participants: { name: string; status: string; docStatus: string; total: number | null }[] };
const ST: Record<string, string> = { submitted: "Awaiting verification", confirmed: "Confirmed", done: "Done" };

/** Jadwal tes rombongan: papan jadwal yang sama dengan admin (hanya lihat), lalu pendaftaran tes EPTA resmi. */
export default function InstJadwal() {
  const { url, ready } = useInstQuery();
  const { data, loading, error } = useApi<{ groups: G[]; sessions: S[] }>(url("/api/inst/schedule"));
  const [pick, setPick] = useState<string | null>(null);
  if (!ready || loading) return <Loading />;
  const groups = data?.groups ?? [], official = data?.sessions ?? [];
  const current = groups.find((g) => g.id === pick) ?? groups[0];
  return (
    <div className="flex flex-col gap-5">
      <ErrorNote text={error} />
      {groups.length === 0 && official.length === 0 && <><h1 className="page-title">Group test schedule</h1><Empty>No scheduled tests for your participants yet. The program admin schedules tests; they appear here automatically.</Empty></>}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">{groups.map((g) => <button key={g.id} role="tab" aria-selected={g.id === current?.id} className={g.id === current?.id ? "btn-solid !min-h-[40px]" : "btn-outline !min-h-[40px]"} onClick={() => setPick(g.id)}>{g.name}</button>)}</div>
      )}
      {current && <ScheduleBoard key={current.id} testId={current.id} readOnly apiUrl={url(`/api/inst/tests/${current.id}/schedule`) ?? undefined} back={{ href: "/institution", label: "← Overview" }} />}

      {official.length > 0 && <h2 className="mt-4 font-display text-xl font-extrabold text-navy">Official EPTA test</h2>}
      {official.map((s) => (
        <section key={s.id} className="card">
          <h3 className="font-display text-lg font-extrabold text-navy">{s.title}</h3>
          <p className="text-sm text-ink-soft">{tgl(s.date, true)} · {s.place} · {s.participants.length} participants</p>
          <div className="table-wrap mt-3"><table><thead><tr><th>Name</th><th>Status</th><th>Documents</th><th>Total score</th></tr></thead>
            <tbody>{s.participants.map((p, i) => <tr key={i}><td className="font-semibold text-navy">{p.name}</td><td>{ST[p.status] ?? p.status}</td><td><span className={p.docStatus === "valid" ? "badge-ok" : p.docStatus === "rejected" ? "badge-bad" : "badge-warn"}>{p.docStatus === "valid" ? "Valid" : p.docStatus === "rejected" ? "Rejected" : "Under review"}</span></td><td>{p.total ?? "-"}</td></tr>)}</tbody></table></div>
        </section>
      ))}
    </div>
  );
}
