"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type L = { email: string; name: string | null; source: string; stage: string; at: string };

export default function Leads() {
  const { data, loading, error } = useApi<{ leads: L[] }>("/api/admin/leads");
  const [stage, setStage] = useState("");
  const [copied, setCopied] = useState(false);
  const rows = (data?.leads ?? []).filter((l) => !stage || l.stage === stage);
  const stages = Array.from(new Set((data?.leads ?? []).map((l) => l.stage)));
  async function copy() { try { await navigator.clipboard.writeText(rows.map((r) => r.email).join(", ")); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard tidak tersedia */ } }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Lead Free Trial</h1><p className="text-sm text-ink-soft">Email dari landing page dan akun yang belum membeli · {rows.length} kontak</p></div><button className="btn-outline" onClick={copy}>{copied ? "Tersalin ✓" : "Salin semua email"}</button></div>
      <select className="field w-auto self-start" aria-label="Tahap" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">Semua tahap</option>{stages.map((s) => <option key={s}>{s}</option>)}</select>
      <ErrorNote text={error} />
      {loading ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Email</th><th>Nama</th><th>Sumber</th><th>Tahap</th><th>Sejak</th></tr></thead>
          <tbody>{rows.map((l) => <tr key={l.email}><td className="font-semibold text-navy">{l.email}</td><td>{l.name ?? "–"}</td><td>{l.source}</td><td><span className="badge-muted">{l.stage}</span></td><td>{tgl(l.at)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">Belum ada lead.</td></tr>}</tbody>
        </table></div>
      )}
    </div>
  );
}
