"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type Level = { key: string; name: string; order: number; scoreMin: number; scoreMax: number; coachingQuota: number };
type Param = { key: string; help: string; value: unknown; isDefault: boolean; default: unknown };
const PLACEHOLDER = ["score_conversion"];

export default function Parameter() {
  const { data, loading, error, reload } = useApi<{ params: Param[]; levels: Level[] }>("/api/admin/params");
  const [levels, setLevels] = useState<Level[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (data) setLevels(data.levels); }, [data]);

  async function saveLevels() {
    setMsg(null);
    try { await api("/api/admin/levels", { method: "PUT", json: { levels: levels.map((l) => ({ ...l, scoreMin: Number(l.scoreMin), scoreMax: Number(l.scoreMax), coachingQuota: Number(l.coachingQuota), order: Number(l.order) })) } }); setMsg({ ok: true, text: "Level disimpan. Berlaku untuk placement berikutnya." }); reload(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  const setL = (i: number, k: keyof Level, v: string) => setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: k === "name" || k === "key" ? v : Number(v) } : l)));

  if (loading && !data) return <Loading />;
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div><h1 className="page-title">Parameter Sistem</h1><p className="text-sm text-ink-soft">Angka yang menentukan level, kuota, dan aturan belajar. Perubahan berlaku tanpa mengubah kode dan tercatat di audit log.</p></div>
      <ErrorNote text={error} />
      {msg && <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-success-tint text-success" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <section className="card flex flex-col gap-3">
        <div><h2 className="font-display text-lg font-extrabold text-navy">Level & kuota coaching</h2><p className="text-sm text-ink-soft">Rentang skor tidak boleh tumpang tindih. Nilai bawaan adalah placeholder sampai ditetapkan.</p></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Urut</th><th>Nama</th><th>Skor min</th><th>Skor maks</th><th>Kuota sesi</th></tr></thead>
          <tbody>{levels.map((l, i) => (
            <tr key={l.key}>
              <td><input aria-label="Urutan" className="field !w-16" type="number" value={l.order} onChange={(e) => setL(i, "order", e.target.value)} /></td>
              <td><input aria-label="Nama level" className="field" value={l.name} onChange={(e) => setL(i, "name", e.target.value)} /></td>
              <td><input aria-label="Skor minimum" className="field !w-24" type="number" min={310} max={677} value={l.scoreMin} onChange={(e) => setL(i, "scoreMin", e.target.value)} /></td>
              <td><input aria-label="Skor maksimum" className="field !w-24" type="number" min={310} max={677} value={l.scoreMax} onChange={(e) => setL(i, "scoreMax", e.target.value)} /></td>
              <td><input aria-label="Kuota coaching" className="field !w-24" type="number" min={0} value={l.coachingQuota} onChange={(e) => setL(i, "coachingQuota", e.target.value)} /></td>
            </tr>))}</tbody>
        </table></div>
        <button className="btn-solid self-start" onClick={saveLevels}>Simpan level</button>
      </section>

      {data?.params.map((p) => <ParamEditor key={p.key} p={p} onSaved={(text, ok) => { setMsg({ ok, text }); if (ok) reload(); }} />)}
    </div>
  );
}

function ParamEditor({ p, onSaved }: { p: Param; onSaved: (text: string, ok: boolean) => void }) {
  const fmt = (v: unknown) => (typeof v === "object" ? JSON.stringify(v, null, 2) : String(v));
  const [text, setText] = useState(fmt(p.value));
  const dirty = text !== fmt(p.value);
  async function save() {
    let value: unknown;
    try { value = JSON.parse(text); } catch { return onSaved(`${p.key}: format JSON tidak valid`, false); }
    try { await api("/api/admin/params", { method: "PUT", json: { key: p.key, value } }); onSaved(`${p.key} disimpan.`, true); } catch (e) { onSaved(`${p.key}: ${(e as Error).message}`, false); }
  }
  return (
    <section className="card flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2"><code className="font-semibold text-navy">{p.key}</code>{p.isDefault && <span className="badge-muted">bawaan</span>}{PLACEHOLDER.includes(p.key) && p.isDefault && <span className="badge-warn">placeholder, verifikasi dulu</span>}</div>
      <p className="text-sm text-ink-soft">{p.help}</p>
      <textarea aria-label={p.key} className="field font-mono text-xs" rows={Math.min(14, text.split("\n").length + 1)} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2"><button className="btn-solid !min-h-[40px]" disabled={!dirty} onClick={save}>Simpan</button><button className="btn-outline !min-h-[40px]" onClick={() => setText(fmt(p.default))}>Kembalikan ke bawaan</button></div>
    </section>
  );
}
