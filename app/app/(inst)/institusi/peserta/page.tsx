"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery } from "@/lib/inst-client";
import { tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { ImportPanel } from "@/components/ImportPanel";

type P = { id: string; status: string; name: string | null; email: string; target: number | null; tests: number; firstScore: number | null; lastScore: number | null; lastAt: string | null };
type D = { participant: { name: string | null; email: string; target: number | null; goal: string | null }; attempts: { id: string; kind: string; scoreEst: number; sections: { section: string; scaled: number }[]; finishedAt: string }[] };
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure", reading: "Reading" };

export default function InstPeserta() {
  const { url, ready, q: q2 } = useInstQuery();
  const [q, setQ] = useState("");
  const { data, loading, error, reload } = useApi<{ participants: P[] }>(url(`/api/inst/participants${q ? `?q=${encodeURIComponent(q)}` : ""}`));
  const [sel, setSel] = useState<string | null>(null);
  if (!ready) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Peserta & undangan</h1><p className="text-sm text-ink-soft">Tambah peserta dan lihat hasil per orang. Hanya peserta institusimu yang tampil.</p></div><a className="btn-outline" href={url("/api/inst/report.xlsx") ?? "#"}>Ekspor Excel</a></div>
      <ImportPanel base="/api/inst" query={q2} onDone={reload} />
      <input className="field max-w-xs" placeholder="Cari nama atau email" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Peserta</th><th>Target</th><th>Tes</th><th>Skor pertama</th><th>Skor terakhir</th><th>Terakhir</th><th /></tr></thead>
          <tbody>
            {data?.participants.map((p) => <tr key={p.id}><td className="font-semibold text-navy">{p.name ?? "(belum ada nama)"}<br /><span className="text-xs font-normal text-ink-soft">{p.email}{p.status === "invited" ? " · menunggu aktivasi" : ""}</span></td><td>{p.target ?? "–"}</td><td>{p.tests}</td><td>{p.firstScore ?? "–"}</td><td className="font-semibold">{p.lastScore ?? "–"}</td><td>{p.lastAt ? tgl(p.lastAt) : "–"}</td><td className="text-right"><button className="font-semibold text-brand" onClick={() => setSel(p.id)}>Hasil</button></td></tr>)}
            {data?.participants.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">Belum ada peserta.</td></tr>}
          </tbody>
        </table></div>
      )}
      {sel && <Detail url={url(`/api/inst/participants/${sel}`)} onClose={() => setSel(null)} />}
    </div>
  );
}

function Detail({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { data, error } = useApi<D>(url);
  return (
    <Modal title="Hasil peserta" onClose={onClose}>
      {!data ? <Loading text={error || "Memuat…"} /> : (
        <div className="flex flex-col gap-3 text-sm">
          <p><b className="text-navy">{data.participant.name ?? data.participant.email}</b> · target {data.participant.target ?? "–"}</p>
          {data.attempts.length ? <ul className="divide-y divide-line">{data.attempts.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2"><span>{a.kind} · {tgl(a.finishedAt)}<br /><span className="text-xs text-ink-soft">{a.sections.map((s) => `${SEC[s.section]} ${s.scaled}`).join(" · ")}</span></span><b className="font-display text-xl text-navy">{a.scoreEst}</b></li>)}</ul> : <p className="text-ink-soft">Belum ada hasil tes.</p>}
        </div>
      )}
    </Modal>
  );
}
