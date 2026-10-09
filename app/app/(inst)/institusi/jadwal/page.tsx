"use client";

import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";

type S = { id: string; title: string; date: string; place: string; participants: { name: string; status: string; docStatus: string; total: number | null }[] };
const ST: Record<string, string> = { submitted: "Awaiting verification", confirmed: "Terkonfirmasi", done: "Done" };

export default function InstJadwal() {
  const { url, ready } = useInstQuery();
  const { data, loading, error } = useApi<{ sessions: S[] }>(url("/api/inst/schedule"));
  if (!ready || loading) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Group test schedule</h1><p className="text-sm text-ink-soft">Participants from your institution registered for the official TOEFL ITP test, per session.</p></div>
      <ErrorNote text={error} />
      {data?.sessions.length === 0 && <Empty>No participants registered for the official test yet.</Empty>}
      {data?.sessions.map((s) => (
        <section key={s.id} className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">{s.title}</h2>
          <p className="text-sm text-ink-soft">{tgl(s.date, true)} · {s.place} · {s.participants.length} participants</p>
          <div className="table-wrap mt-3"><table><thead><tr><th>Name</th><th>Status</th><th>Documents</th><th>Total score</th></tr></thead>
            <tbody>{s.participants.map((p, i) => <tr key={i}><td className="font-semibold text-navy">{p.name}</td><td>{ST[p.status] ?? p.status}</td><td><span className={p.docStatus === "valid" ? "badge-ok" : p.docStatus === "rejected" ? "badge-bad" : "badge-warn"}>{p.docStatus === "valid" ? "Valid" : p.docStatus === "rejected" ? "Rejected" : "Under review"}</span></td><td>{p.total ?? "-"}</td></tr>)}</tbody></table></div>
        </section>
      ))}
    </div>
  );
}
