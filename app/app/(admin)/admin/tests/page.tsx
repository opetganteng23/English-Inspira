"use client";

import { useCallback, useEffect, useState } from "react";

type T = { id: string; name: string; kind: string; active: boolean; questions: number; durationSec: number; attempts: number };
type QRow = { _id: string; section: string; type: string; stem: string };
type Sec = { name: string; durationSec: number; questionIds: string[] };
type Draft = { id?: string; name: string; kind: string; levelId: string; active: boolean; sections: Sec[]; attempts: number };

const SECTION: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const KIND: Record<string, string> = { placement: "Placement", sim: "Simulation", practice: "Practice", quiz: "Unit quiz" };
const DEFAULT_MIN: Record<string, number> = { listening: 35, structure: 25, reading: 55 };

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong");
  return d;
}

export default function TesAdmin() {
  const [tests, setTests] = useState<T[]>([]);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => api("/api/admin/tests").then((d) => { setTests(d.tests); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function open(id: string) {
    try { const t = await api(`/api/admin/tests/${id}`); setDraft({ id, name: t.name, kind: t.kind, levelId: t.levelId ? String(t.levelId) : "", active: t.active, attempts: t.attempts, sections: t.sections.map((s: Sec) => ({ name: s.name, durationSec: s.durationSec, questionIds: s.questionIds.map(String) })) }); }
    catch (e) { setErr((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this test?")) return;
    try { await api(`/api/admin/tests/${id}`, { method: "DELETE" }); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Tests</h1>
          <p className="text-sm text-ink-soft">Build tests from published questions in the Question Bank.</p>
        </div>
        <button onClick={() => setDraft({ name: "", kind: "placement", levelId: "", active: true, attempts: 0, sections: [{ name: "listening", durationSec: 35 * 60, questionIds: [] }, { name: "structure", durationSec: 25 * 60, questionIds: [] }, { name: "reading", durationSec: 55 * 60, questionIds: [] }] })}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ New test</button>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase text-ink-soft"><tr><th className="p-3">Name</th><th>Type</th><th>Question</th><th>Duration</th><th>Attempts</th><th>Status</th><th /></tr></thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="p-3 font-semibold text-navy">{t.name}</td><td>{KIND[t.kind]}</td><td>{t.questions}</td><td>{Math.round(t.durationSec / 60)} min</td><td>{t.attempts}×</td>
                <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.active ? "bg-success-tint text-success" : "bg-canvas text-ink-soft"}`}>{t.active ? "active" : "inactive"}</span></td>
                <td className="whitespace-nowrap p-3 text-right"><button className="mr-3 font-semibold text-brand" onClick={() => open(t.id)}>Edit</button><button className="font-semibold text-red-700" onClick={() => remove(t.id)}>Delete</button></td>
              </tr>
            ))}
            {tests.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-soft">No tests yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {draft && <Builder draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
    </div>
  );
}

function Builder({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(draft);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { api("/api/admin/levels").then((d) => setLevels(d.levels)).catch(() => {}); }, []);
  const locked = v.attempts > 0; // susunan dikunci bila sudah dikerjakan

  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { name: v.name, kind: v.kind, levelId: v.levelId || null, active: v.active, sections: v.sections.filter((s) => s.questionIds.length) };
      await api(v.id ? `/api/admin/tests/${v.id}` : "/api/admin/tests", { method: v.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const setSec = (i: number, s: Sec) => setV((x) => ({ ...x, sections: x.sections.map((o, j) => (j === i ? s : o)) }));

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-navy">{v.id ? "Edit test" : "New test"}</h2><button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-ink-soft">×</button></div>
        {locked && <p className="mb-4 rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">This test has been taken {v.attempts} times. The question set and durations are locked so earlier scores stay valid. You can still change the name and active status.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy sm:col-span-2">Test name<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Type<select disabled={locked} className="field" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(KIND).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active (shown in the test list)</label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-navy sm:max-w-xs">Target level<select disabled={locked || v.kind === "placement"} className="field font-normal" value={v.kind === "placement" ? "" : v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}><option value="">All levels</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        {v.kind === "placement" && <p className="mt-2 text-xs text-ink-soft">Placement is taken once per participant and determines their level, so it is not limited by level.</p>}
        {v.kind === "quiz" && <p className="mt-2 text-xs text-ink-soft">Unit quizzes do not appear in My Tests; they are taken from learning units.</p>}

        <div className="mt-5 flex flex-col gap-5">
          {v.sections.map((s, i) => <SectionBox key={s.name} s={s} locked={locked} onChange={(n) => setSec(i, n)} />)}
        </div>
        {err && <p role="alert" className="mt-4 text-sm text-red-700">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save test"}</button>
        </div>
      </div>
    </div>
  );
}

function SectionBox({ s, locked, onChange }: { s: Sec; locked: boolean; onChange: (s: Sec) => void }) {
  const [chosen, setChosen] = useState<QRow[]>([]);
  const [q, setQ] = useState("");
  const [pool, setPool] = useState<QRow[]>([]);

  // Muat detail soal terpilih (urutan mengikuti questionIds).
  useEffect(() => {
    if (!s.questionIds.length) return setChosen([]);
    api(`/api/admin/questions?ids=${s.questionIds.join(",")}`).then((d) => setChosen(d.items)).catch(() => {});
  }, [s.questionIds]);

  useEffect(() => {
    if (locked) return;
    const t = setTimeout(() => api(`/api/admin/questions?section=${s.name}&status=published&q=${encodeURIComponent(q)}`).then((d) => setPool(d.items)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, s.name, locked]);

  const ids = s.questionIds;
  const move = (i: number, d: number) => { const a = [...ids]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange({ ...s, questionIds: a }); };

  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-2 font-display font-extrabold text-navy">{SECTION[s.name]} · {ids.length} questions</legend>
      <label className="flex items-center gap-2 text-sm font-semibold text-navy">Duration (minutes)
        <input type="number" min={1} max={180} disabled={locked} className="field w-24" value={Math.round(s.durationSec / 60)} onChange={(e) => onChange({ ...s, durationSec: Math.max(1, Number(e.target.value) || DEFAULT_MIN[s.name]) * 60 })} />
      </label>
      <ol className="mt-3 flex flex-col gap-1.5">
        {ids.map((id, i) => {
          const r = chosen.find((c) => c._id === id);
          return (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-1.5 text-sm">
              <span className="w-6 font-semibold text-ink-soft">{i + 1}</span>
              <span className="flex-1 truncate">{r ? r.stem : id}</span>
              {!locked && <>
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="px-1 text-xs font-semibold disabled:opacity-30">Up</button>
                <button disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="px-1 text-xs font-semibold disabled:opacity-30">Down</button>
                <button onClick={() => onChange({ ...s, questionIds: ids.filter((x) => x !== id) })} aria-label="Remove" className="px-1 text-red-700">×</button>
              </>}
            </li>
          );
        })}
        {ids.length === 0 && <li className="text-sm text-ink-soft">No questions yet. Choose from the list below.</li>}
      </ol>
      {!locked && (
        <div className="mt-3">
          <input className="field mb-2" placeholder={`Search ${SECTION[s.name]} questions (published)`} value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-line">
            {pool.filter((p) => !ids.includes(p._id)).map((p) => (
              <li key={p._id} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0">
                <span className="flex-1 truncate">{p.stem}</span><span className="text-xs text-ink-soft">{p.type}</span>
                <button onClick={() => onChange({ ...s, questionIds: [...ids, p._id] })} className="font-semibold text-brand">+ Add</button>
              </li>
            ))}
            {pool.filter((p) => !ids.includes(p._id)).length === 0 && <li className="p-3 text-sm text-ink-soft">No matching published questions.</li>}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
