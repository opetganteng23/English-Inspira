"use client";

import { askConfirm } from "@/components/Feedback";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; name: string; description: string; version: number; mode: "linear" | "table"; verified: boolean; source: string; isDefault: boolean; status: "active" | "archived"; verifiedAt: string | null; tests: number; attempts: number };
type Tables = Record<"listening" | "structure" | "reading", Record<string, number>>;
type Detail = { id: string; name: string; description: string; version: number; mode: "linear" | "table"; scaledMin: number; scaledMax: number; tables: Tables; verified: boolean; source: string; verifiedAt: string | null; isDefault: boolean; status: string };
const SEC = [["listening", "Listening", 50], ["structure", "Structure & WE", 40], ["reading", "Reading", 50]] as const;
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export default function ScoringProfiles() {
  const { data, loading, error, reload } = useApi<{ profiles: Row[] }>("/api/admin/scoring");
  const [edit, setEdit] = useState<string | "new" | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  async function act(id: string, body: object, ok: string) {
    setErr(""); setMsg("");
    try { await api(`/api/admin/scoring/${id}`, { json: body }); setMsg(ok); reload(); } catch (e) { setErr((e as Error).message); }
  }
  async function del(p: Row) {
    if (!(await askConfirm(`Delete the profile "${p.name}"?`))) return;
    setErr(""); setMsg("");
    try { await api(`/api/admin/scoring/${p.id}`, { method: "DELETE" }); setMsg("Profile deleted."); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Scoring Profiles</h1>
          <p className="max-w-3xl text-sm text-ink-soft">How raw scores become TOEFL ITP section scores (31-68) and a total (310-677). Do not turn percentages into official scores directly: use a conversion table from a legitimate source, then mark it verified. Until then, results are labeled as a provisional estimate.</p>
        </div>
        <button className="btn-solid" onClick={() => setEdit("new")}>+ New profile</button>
      </div>
      {msg && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{msg}</p>}
      <ErrorNote text={error || err} />
      {loading && !data ? <Loading /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data?.profiles.map((p) => (
            <section key={p.id} className={`card flex flex-col gap-3 !p-4 ${p.status === "archived" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-extrabold text-navy">{p.name}</h2>
                {p.isDefault && <span className="badge-ok">Default</span>}
                {p.status === "archived" && <span className="badge-muted">Archived</span>}
                <span className="badge-muted">v{p.version}</span>
              </div>
              {p.description && <p className="text-sm text-ink-soft">{p.description}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={p.verified ? "badge-ok" : "badge-warn"}>{p.verified ? "Verified" : "Provisional"}</span>
                <span className="badge-muted">{p.mode === "table" ? "Conversion table" : "Linear estimate"}</span>
                <span className="text-ink-soft">{p.tests} test{p.tests === 1 ? "" : "s"} · {p.attempts} result{p.attempts === 1 ? "" : "s"}</span>
              </div>
              {p.verified && <p className="text-xs text-ink-soft">Source: {p.source}{p.verifiedAt ? ` · verified ${tgl(p.verifiedAt)}` : ""}</p>}
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-sm font-semibold">
                <button className="text-brand" onClick={() => setEdit(p.id)}>Edit</button>
                <button className="text-brand" onClick={() => act(p.id, { action: "duplicate" }, "Profile duplicated.")}>Duplicate</button>
                {!p.isDefault && p.status === "active" && <button className="text-brand" onClick={() => act(p.id, { action: "set_default" }, `"${p.name}" is now the default.`)}>Set as default</button>}
                {p.status === "active" ? !p.isDefault && <button className="text-ink-soft" onClick={() => act(p.id, { action: "archive" }, "Profile archived.")}>Archive</button> : <button className="text-ink-soft" onClick={() => act(p.id, { action: "unarchive" }, "Profile restored.")}>Restore</button>}
                {!p.isDefault && <button className="text-red-700" onClick={() => del(p)}>Delete</button>}
              </div>
            </section>
          ))}
        </div>
      )}
      {edit && <Editor id={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); setMsg(m); reload(); }} />}
    </div>
  );
}

const emptyTables = (): Tables => ({ listening: {}, structure: {}, reading: {} });

function Editor({ id, onClose, onSaved }: { id: string | "new"; onClose: () => void; onSaved: (m: string) => void }) {
  const isNew = id === "new";
  const { data: d, error } = useApi<Detail>(isNew ? "" : `/api/admin/scoring/${id}`);
  const [v, setV] = useState<Pick<Detail, "name" | "description" | "mode" | "scaledMin" | "scaledMax" | "tables"> | null>(isNew ? { name: "", description: "", mode: "table", scaledMin: 31, scaledMax: 68, tables: emptyTables() } : null);
  const [tab, setTab] = useState<"listening" | "structure" | "reading">("listening");
  const [paste, setPaste] = useState(""); const [fillN, setFillN] = useState(50);
  const [check, setCheck] = useState<{ errors: string[]; warnings: string[]; sections: { section: string; scaled: number }[]; total: number } | null>(null);
  const [calc, setCalc] = useState<Record<string, number>>({ listening: 35, structure: 28, reading: 35 });
  const [src, setSrc] = useState(""); const [sure, setSure] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => { if (d && !v) setV({ name: d.name, description: d.description, mode: d.mode, scaledMin: d.scaledMin, scaledMax: d.scaledMax, tables: d.tables }); }, [d, v]);

  // Validasi dan kalkulator hidup (debounce) memakai aturan yang sedang diedit.
  useEffect(() => {
    if (!v) return;
    const t = setTimeout(() => {
      api("/api/admin/scoring/preview", { json: { profile: { ...v, name: v.name || "preview" }, sections: SEC.map(([k, , n]) => ({ section: k, raw: Math.min(calc[k] ?? 0, n), total: n })) } })
        .then(setCheck).catch((e) => setCheck({ errors: [(e as Error).message], warnings: [], sections: [], total: 0 }));
    }, 350);
    return () => clearTimeout(t);
  }, [v, calc]);

  if (!v) return <Modal title="Scoring profile" onClose={onClose} wide>{error ? <ErrorNote text={error} /> : <Loading />}</Modal>;
  const rows = Object.entries(v.tables[tab]).map(([k, s]) => [Number(k), s] as [number, number]).sort((a, b) => a[0] - b[0]);
  const setRows = (r: [number, number][]) => setV({ ...v, tables: { ...v.tables, [tab]: Object.fromEntries(r.map(([k, s]) => [String(k), s])) } });
  const locked = !isNew && d?.verified;

  function applyPaste() {
    const out: [number, number][] = [];
    for (const line of paste.split(/\r?\n/)) { const m = line.trim().match(/^(\d{1,3})\s*[,;\t ]\s*(\d{1,4})$/); if (m) out.push([Number(m[1]), Number(m[2])]); }
    if (!out.length) { setInfo("No valid rows found. Use one row per line: raw, scaled (for example 30, 55)."); return; }
    setRows(out); setPaste(""); setInfo(`${out.length} rows loaded.`);
  }
  function fillLinear() {
    const r: [number, number][] = [];
    for (let i = 0; i <= fillN; i++) r.push([i, Math.round(v!.scaledMin + ((v!.scaledMax - v!.scaledMin) * i) / fillN)]);
    setRows(r); setInfo(`Filled ${fillN + 1} rows with a linear curve. Replace them with the official values before verifying.`);
  }
  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { ...v, description: v!.description || undefined };
      const r = isNew ? await api("/api/admin/scoring", { json: body }) : await api(`/api/admin/scoring/${id}`, { method: "PATCH", json: body });
      onSaved(isNew ? "Profile created. It is provisional until you verify it." : r.rulesChanged ? `Saved as version ${r.version}. Verification was cleared because the conversion changed.` : "Profile saved.");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function verify() {
    setBusy(true); setErr("");
    try { await api(`/api/admin/scoring/${id}`, { json: { action: "verify", source: src, confirm: sure } }); onSaved("Profile marked as verified."); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title={isNew ? "New scoring profile" : "Edit scoring profile"} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Name<input className="field font-normal" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className={label}>Description (optional)<input className="field font-normal" maxLength={400} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        </div>
        {!isNew && d && <p className="text-sm text-ink-soft">Version {d.version}. {d.verified ? <>Verified: <b className="text-success">{d.source}</b>. Changing the conversion clears the verification and raises the version.</> : "Not verified yet."}</p>}

        <div className={label}>Conversion type
          <div className="flex gap-1 rounded-lg bg-canvas p-1 text-sm" role="radiogroup" aria-label="Conversion type">
            {([["table", "Conversion table (official values)"], ["linear", "Linear estimate (provisional)"]] as const).map(([k, n]) => (
              <button key={k} type="button" role="radio" aria-checked={v.mode === k} onClick={() => setV({ ...v, mode: k })} className={`flex-1 rounded-md px-3 py-2 font-semibold ${v.mode === k ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <label className={label}>Lowest scaled score<input type="number" className="field font-normal" value={v.scaledMin} onChange={(e) => setV({ ...v, scaledMin: Number(e.target.value) })} /></label>
          <label className={label}>Highest scaled score<input type="number" className="field font-normal" value={v.scaledMax} onChange={(e) => setV({ ...v, scaledMax: Number(e.target.value) })} /></label>
        </div>

        {v.mode === "table" && (
          <section className="rounded-xl border border-line">
            <div className="flex gap-1 border-b border-line bg-canvas p-1" role="tablist" aria-label="Section">
              {SEC.map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${tab === k ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{n} <span className="text-xs font-normal">({Object.keys(v.tables[k]).length})</span></button>)}
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-sm"><thead className="sticky top-0 bg-canvas text-xs uppercase text-ink-soft"><tr><th className="p-2 text-left">Raw (correct answers)</th><th className="p-2 text-left">Scaled score</th><th /></tr></thead>
                    <tbody>
                      {rows.map(([raw, scaled], i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="p-1.5"><input aria-label={`Raw ${i + 1}`} type="number" min={0} className="field !h-9 w-24" value={raw} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [Number(e.target.value), r[1]] : r)))} /></td>
                          <td className="p-1.5"><input aria-label={`Scaled ${i + 1}`} type="number" className="field !h-9 w-24" value={scaled} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [r[0], Number(e.target.value)] : r)))} /></td>
                          <td className="p-1.5 text-right"><button type="button" aria-label="Remove row" className="px-2 text-red-700" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button></td>
                        </tr>
                      ))}
                      {rows.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-ink-soft">No rows yet. Paste a table or add rows.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => setRows([...rows, [rows.length ? rows[rows.length - 1][0] + 1 : 0, v.scaledMin]])}>+ Add row</button>
              </div>
              <div className="flex flex-col gap-2">
                <label className={label}>Paste table<textarea className="field font-normal" rows={6} placeholder={"0, 31\n1, 31\n2, 32\n..."} value={paste} onChange={(e) => setPaste(e.target.value)} /></label>
                <button type="button" className="btn-outline !min-h-[40px]" onClick={applyPaste} disabled={!paste.trim()}>Load pasted rows</button>
                <div className="mt-2 flex items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Questions<input type="number" min={1} max={300} className="field !h-9 w-20" value={fillN} onChange={(e) => setFillN(Math.max(1, Number(e.target.value) || 1))} /></label>
                  <button type="button" className="btn-outline !min-h-[36px] text-sm" onClick={fillLinear}>Fill linear</button>
                </div>
                {info && <p role="status" className="text-xs text-ink-soft">{info}</p>}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl bg-canvas p-4" aria-label="Score calculator">
          <h3 className="font-semibold text-navy">Try it</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {SEC.map(([k, n, tot]) => (
              <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-navy">{n}: correct of {tot}
                <input type="number" min={0} max={tot} className="field !h-10" value={calc[k]} onChange={(e) => setCalc({ ...calc, [k]: Math.max(0, Math.min(tot, Number(e.target.value) || 0)) })} />
                <span className="text-sm font-normal text-ink-soft">Scaled: <b className="text-navy">{check?.sections.find((s) => s.section === k)?.scaled ?? "-"}</b></span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm">Estimated total: <b className="font-display text-xl text-navy">{check?.total ?? "-"}</b> <span className="text-xs text-ink-soft">(average of the three sections × 10, limited to 310-677)</span></p>
        </section>

        {check?.errors.length ? <ul role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        {check?.warnings.length ? <ul className="rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">{check.warnings.map((e) => <li key={e}>{e}</li>)}</ul> : null}

        {!isNew && d && v.mode === "table" && !d.verified && (
          <section className="rounded-xl border border-accent p-4">
            <h3 className="font-semibold text-navy">Verify this conversion</h3>
            <p className="text-sm text-ink-soft">Mark it verified only after comparing every row with a legitimate source for the test version you simulate. Saved edits above are not included: save first, then verify.</p>
            <label className={`${label} mt-2`}>Source (document, version, date)<input className="field font-normal" maxLength={300} value={src} onChange={(e) => setSrc(e.target.value)} placeholder="e.g. Official conversion table for form XYZ, received 2026-09-01" /></label>
            <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={sure} onChange={(e) => setSure(e.target.checked)} />I compared this table with the source and it matches.</label>
            <button type="button" className="btn-accent mt-3" disabled={busy || src.trim().length < 5 || !sure} onClick={verify}>Mark as verified</button>
          </section>
        )}
        {locked && <p className="text-xs text-ink-soft">This profile is verified. If you change the conversion it becomes version {(d?.version ?? 1) + 1} and must be verified again.</p>}

        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={busy || !v.name.trim() || !!check?.errors.length} onClick={save}>{busy ? "Saving…" : "Save profile"}</button></div>
      </div>
    </Modal>
  );
}
