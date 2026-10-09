"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/compress-image";

type Row = { _id: string; section: string; type: string; stem: string; status: string; difficulty: string };
type Group = { id: string; section: string; instruction?: string; passageTitle?: string; audioId: string | null; questions: number };
const SKILLS = ["listening", "structure", "reading"];
type AudioRow = { id: string; title: string; durationSec: number; inUse: boolean };
type Form = {
  id?: string; section: string; type: string; groupId: string; stem: string; options: string[]; answerKey: number;
  explanation: string; tags: { skill: string; topic: string }[]; difficulty: string; status: string; assetIds: string[];
};

const SECTION: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const empty = (section = "structure"): Form => ({ section, type: "", groupId: "", stem: "", options: ["", "", "", ""], answerKey: 0, explanation: "", tags: [], difficulty: "medium", status: "draft", assetIds: [] });
const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Terjadi kesalahan");
  return d;
}

export default function BankSoal() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [f, setF] = useState({ section: "", status: "", q: "" });
  const [err, setErr] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [groupDlg, setGroupDlg] = useState(false);
  const [importDlg, setImportDlg] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ page: String(page) });
    Object.entries(f).forEach(([k, v]) => v && sp.set(k, v));
    try { const d = await api(`/api/admin/questions?${sp}`); setRows(d.items); setPages(d.pages); setTotal(d.total); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, [page, f]);
  useEffect(() => { load(); }, [load]);

  async function edit(id: string) {
    try {
      const q = await api(`/api/admin/questions/${id}`);
      setForm({ id, section: q.section, type: q.type, groupId: q.groupId ?? "", stem: q.stem, options: q.options, answerKey: q.answerKey, explanation: q.explanation ?? "", tags: (q.tags ?? []).map((t: { skill: string; topic: string }) => ({ skill: t.skill, topic: t.topic })), difficulty: q.difficulty, status: q.status, assetIds: q.assetIds ?? [] });
    } catch (e) { setErr((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    try { await api(`/api/admin/questions/${id}`, { method: "DELETE" }); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Question Bank</h1>
          <p className="text-sm text-ink-soft">{total} questions · used for Placement, Simulation, Practice, and Unit quizzes. Published questions must have a skill + topic tag.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Import Excel/CSV</button>
          <button onClick={() => setGroupDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">+ Grup audio/passage</button>
          <button onClick={() => setForm(empty(f.section || "structure"))} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ New question</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Search question text" value={f.q} onChange={(e) => { setPage(1); setF({ ...f, q: e.target.value }); }} />
        <select className="field w-auto" value={f.section} onChange={(e) => { setPage(1); setF({ ...f, section: e.target.value }); }}>
          <option value="">All sections</option>{Object.entries(SECTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="field w-auto" value={f.status} onChange={(e) => { setPage(1); setF({ ...f, status: e.target.value }); }}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option>
        </select>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase text-ink-soft"><tr><th className="p-3">Section</th><th>Type</th><th>Question</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-line">
                <td className="p-3 font-semibold text-navy">{SECTION[r.section]}</td><td>{r.type}</td>
                <td className="max-w-md truncate">{r.stem}</td>
                <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "published" ? "bg-success-tint text-success" : "bg-accent-tint text-accent-dark"}`}>{r.status}</span></td>
                <td className="whitespace-nowrap p-3 text-right"><button className="mr-3 font-semibold text-brand" onClick={() => edit(r._id)}>Edit</button><button className="font-semibold text-red-700" onClick={() => remove(r._id)}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No questions yet. Click “New question”.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line-strong px-3 py-1.5 disabled:opacity-40">Previous</button>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line-strong px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      {form && <Editor form={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} onNewGroup={() => setGroupDlg(true)} />}
      {groupDlg && <GroupDialog onClose={() => setGroupDlg(false)} />}
      {importDlg && <ImportDialog onClose={() => { setImportDlg(false); load(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-navy">{title}</h2><button onClick={onClose} aria-label="Tutup" className="text-2xl leading-none text-ink-soft">×</button></div>
        {children}
      </div>
    </div>
  );
}
const Label = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">{t}{children}</label>;

function Editor({ form, onClose, onSaved, onNewGroup }: { form: Form; onClose: () => void; onSaved: () => void; onNewGroup: () => void }) {
  const [v, setV] = useState(form);
  const [groups, setGroups] = useState<Group[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((x) => ({ ...x, [k]: val }));

  useEffect(() => { api(`/api/admin/groups?section=${v.section}`).then((d) => setGroups(d.groups)).catch(() => {}); }, [v.section]);

  async function save() {
    setBusy(true); setErr("");
    try {
      const body = {
        section: v.section, type: v.type, groupId: v.groupId || null, stem: v.stem, options: v.options, answerKey: v.answerKey,
        explanation: v.explanation || undefined, tags: v.tags.filter((t) => t.skill.trim() && t.topic.trim()), difficulty: v.difficulty, status: v.status, assetIds: v.assetIds,
      };
      const d = await api(v.id ? `/api/admin/questions/${v.id}` : "/api/admin/questions", { method: v.id ? "PATCH" : "POST", ...json(body) });
      if (d.usedInTest) alert("This question is used by a test. Changing the key or options affects future test scores; saved results are not recalculated.");
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function attach(file?: File) {
    if (!file) return;
    try { const a = await uploadImage(file); set("assetIds", [...v.assetIds, a.id]); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <Modal title={v.id ? "Edit question" : "New question"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Label t="Section"><select className="field" value={v.section} onChange={(e) => { set("section", e.target.value); set("groupId", ""); }}>{Object.entries(SECTION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Label>
          <Label t="Question type"><input className="field font-normal" placeholder="mis. subject-verb, inference" value={v.type} onChange={(e) => set("type", e.target.value)} /></Label>
        </div>
        <Label t="Grup (audio / passage)">
          <div className="flex gap-2">
            <select className="field font-normal" value={v.groupId} onChange={(e) => set("groupId", e.target.value)}>
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.passageTitle || g.instruction || g.id.slice(-6)}{g.audioId ? " 🔊" : ""} ({g.questions} questions)</option>)}
            </select>
            <button type="button" onClick={onNewGroup} className="shrink-0 rounded-lg border border-line-strong px-3 text-sm">+ New</button>
          </div>
        </Label>
        <Label t="Question text"><textarea className="field h-24 py-2 font-normal" value={v.stem} onChange={(e) => set("stem", e.target.value)} /></Label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy">Answer options (select the correct one)</legend>
          {v.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="key" aria-label={`Correct answer ${"ABCDEF"[i]}`} checked={v.answerKey === i} onChange={() => set("answerKey", i)} />
              <span className="w-5 text-sm font-semibold">{"ABCDEF"[i]}</span>
              <input className="field" value={o} onChange={(e) => set("options", v.options.map((x, j) => (j === i ? e.target.value : x)))} />
              {v.options.length > 2 && <button type="button" aria-label="Remove option" className="text-red-700" onClick={() => { set("options", v.options.filter((_, j) => j !== i)); set("answerKey", v.answerKey >= i && v.answerKey > 0 ? v.answerKey - 1 : v.answerKey); }}>×</button>}
            </div>
          ))}
          {v.options.length < 6 && <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => set("options", [...v.options, ""])}>+ Add option</button>}
        </fieldset>
        <Label t="Explanation"><textarea className="field h-20 py-2 font-normal" value={v.explanation} onChange={(e) => set("explanation", e.target.value)} /></Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label t="Difficulty"><select className="field" value={v.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Label>
          <Label t="Status"><select className="field" value={v.status} onChange={(e) => set("status", e.target.value)}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option></select></Label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy">Tag skill + topic {v.status === "published" && <span className="font-normal text-red-700">(at least one required for published)</span>}</legend>
          <datalist id="skills">{SKILLS.map((k) => <option key={k} value={k} />)}</datalist>
          {v.tags.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
              <input aria-label="Skill" list="skills" className="field font-normal" placeholder="skill" value={t.skill} onChange={(e) => set("tags", v.tags.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} />
              <input aria-label="Topic" className="field font-normal" placeholder="topic, mis. subject-verb agreement" value={t.topic} onChange={(e) => set("tags", v.tags.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)))} />
              <button type="button" aria-label="Remove tag" className="px-2 text-red-700" onClick={() => set("tags", v.tags.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {v.tags.length < 10 && <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => set("tags", [...v.tags, { skill: v.section, topic: "" }])}>+ Add tag</button>}
        </fieldset>
        {v.section === "listening" && <AudioPicker groups={groups} groupId={v.groupId} onGroup={(id, g) => { set("groupId", id); if (g) setGroups((x) => [...x, g]); }} />}
        <div>
          <p className="mb-1 text-sm font-semibold text-navy">Images (auto-compressed to 300 KB or less)</p>
          <div className="flex flex-wrap items-center gap-3">
            {v.assetIds.map((id) => (
              <span key={id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/assets/${id}`} alt="Question attachment" className="h-16 rounded-lg border border-line" />
                <button type="button" aria-label="Remove image" onClick={() => set("assetIds", v.assetIds.filter((x) => x !== id))} className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-600 text-xs text-white">×</button>
              </span>
            ))}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => attach(e.target.files?.[0])} className="text-sm" />
          </div>
        </div>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<{ dry: boolean; created: number; failed: { row: number; reason: string }[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(dry: boolean) {
    const f = file.current?.files?.[0];
    if (!f) return setErr("Choose a CSV or Excel file first");
    setBusy(true); setErr(""); setRes(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`/api/admin/questions/import${dry ? "?dry=1" : ""}`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Import failed");
      setRes(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal title="Import questions from Excel/CSV" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">Columns: section, type, stem, A-F (options), answer (A-F), explanation, difficulty (easy/medium/hard), tags (<code>skill:topic; skill:topic</code>), status. Maximum 500 rows. Questions with status <b>published</b> must be tagged. Audio and passages are linked manually after import. <a className="font-semibold text-brand" href="/api/admin/questions/import">Download template</a></p>
        <input ref={file} type="file" aria-label="Question file" accept=".csv,.xlsx" className="field" />
        {err && <p role="alert" className="text-red-700">{err}</p>}
        <div className="flex flex-wrap gap-2"><button className="rounded-lg border border-line-strong px-4 py-2 font-semibold" disabled={busy} onClick={() => run(true)}>Check first (without saving)</button><button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => run(false)}>Import</button></div>
        {res && (
          <div role="status" className="rounded-xl bg-canvas p-3">
            <p><b>{res.created}</b> rows {res.dry ? "valid (not saved yet)" : "imported"} · <b className={res.failed.length ? "text-red-700" : ""}>{res.failed.length}</b> failed</p>
            {res.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-red-700">{res.failed.slice(0, 30).map((f) => <li key={f.row}>Row {f.row}: {f.reason}</li>)}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** T-AUD: audio langsung di soal Listening. Memilih/mengunggah audio otomatis memakai grup yang sudah ada untuk audio itu, atau membuatnya. */
function AudioPicker({ groups, groupId, onGroup }: { groups: Group[]; groupId: string; onGroup: (id: string, created?: Group) => void }) {
  const [audios, setAudios] = useState<AudioRow[]>([]);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const current = groups.find((g) => g.id === groupId);
  const audioId = current?.audioId ?? "";

  const loadAudio = useCallback(() => api("/api/admin/audio").then((d) => setAudios(d.audio)).catch(() => {}), []);
  useEffect(() => { loadAudio(); }, [loadAudio]);

  async function pickAudio(id: string) {
    setErr("");
    if (!id) return onGroup("");
    const existing = groups.find((g) => g.audioId === id);
    if (existing) return onGroup(existing.id);
    try {
      const g = await api("/api/admin/groups", { method: "POST", ...json({ section: "listening", audioId: id }) });
      onGroup(g.id, { id: g.id, section: "listening", audioId: id, questions: 0 });
    } catch (e) { setErr((e as Error).message); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setErr(""); setMsg("Uploading…");
    if (file.size > 15 * 1024 * 1024) { setMsg(""); return setErr("Maximum 15 MB"); }
    const fd = new FormData(); fd.append("file", file); if (title) fd.append("title", title); if (transcript) fd.append("transcript", transcript);
    try { const d = await api("/api/audio", { method: "POST", body: fd }); setMsg(d.deduped ? "The same file already exists and was reused." : `Uploaded (${d.durationSec} sec).`); await loadAudio(); await pickAudio(d.audioId); }
    catch (e) { setMsg(""); setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <p className="text-sm font-semibold text-navy">Listening audio for this question</p>
      <select aria-label="Saved audio" className="field font-normal" value={audioId} onChange={(e) => pickAudio(e.target.value)}>
        <option value="">Choose saved audio</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec} sec){a.inUse ? " · in use" : ""}</option>)}
      </select>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand">Upload new audio</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input aria-label="Audio title" className="field font-normal" placeholder="Audio title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label="Transkrip" className="field h-16 py-2 font-normal" placeholder="Transcript (admin only; shown to participants after the test)" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <input type="file" aria-label="File MP3" accept=".mp3,audio/mpeg" className="text-sm" onChange={(e) => upload(e.target.files?.[0])} />
          <p className="text-xs text-ink-soft">MP3, max 15 MB / 10 minutes.</p>
        </div>
      </details>
      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {audioId && <audio controls controlsList="nodownload" src={`/api/audio/${audioId}`} className="w-full" />}
      {current && <p className="text-xs text-ink-soft">This question is part of that audio group{current.questions ? `, together with ${current.questions} other questions` : ""}. Several questions can share one audio.</p>}
    </div>
  );
}

function GroupDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState("listening");
  const [instruction, setInstruction] = useState("");
  const [audioId, setAudioId] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [passageTitle, setPassageTitle] = useState("");
  const [passageHtml, setPassageHtml] = useState("");
  const [audios, setAudios] = useState<AudioRow[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAudio = useCallback(() => api("/api/admin/audio").then((d) => setAudios(d.audio)).catch(() => {}), []);
  useEffect(() => { loadAudio(); }, [loadAudio]);

  async function upload(file?: File) {
    if (!file) return;
    setErr(""); setMsg("Uploading…");
    if (file.size > 15 * 1024 * 1024) { setMsg(""); return setErr("Maximum 15 MB"); }
    const fd = new FormData(); fd.append("file", file); if (title) fd.append("title", title); if (transcript) fd.append("transcript", transcript);
    try { const d = await api("/api/audio", { method: "POST", body: fd }); setAudioId(d.audioId); setMsg(d.deduped ? "The same file already exists and was reused." : `Uploaded (${d.durationSec} sec).`); loadAudio(); }
    catch (e) { setMsg(""); setErr((e as Error).message); }
  }
  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/admin/groups", { method: "POST", ...json({ section, instruction: instruction || undefined, audioId: audioId || null, passageTitle: passageTitle || undefined, passageHtml: passageHtml || undefined }) });
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title="Grup audio / passage" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">One audio or passage can be used by several questions. Create a group here, then select it when creating questions.</p>
        <Label t="Section"><select className="field" value={section} onChange={(e) => setSection(e.target.value)}>{Object.entries(SECTION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Label>
        <Label t="Instruksi"><input className="field font-normal" placeholder="Listen to the conversation." value={instruction} onChange={(e) => setInstruction(e.target.value)} /></Label>
        {section === "listening" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <Label t="Saved audio">
              <select className="field font-normal" value={audioId} onChange={(e) => setAudioId(e.target.value)}>
                <option value="">Choose or upload new</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec} sec){a.inUse ? " · in use" : ""}</option>)}
              </select>
            </Label>
            <Label t="Audio title (optional)"><input className="field font-normal" value={title} onChange={(e) => setTitle(e.target.value)} /></Label>
            <Label t="Transcript (admin only; shown to participants after the test)"><textarea className="field h-20 py-2 font-normal" value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Label>
            <label className="text-sm font-semibold text-navy">Upload MP3 (max 15 MB, 10 minutes)
              <input type="file" accept=".mp3,audio/mpeg" className="mt-1 block text-sm font-normal" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {msg && <p className="text-sm text-success">{msg}</p>}
            {audioId && <audio controls controlsList="nodownload" src={`/api/audio/${audioId}`} className="w-full" />}
          </div>
        ) : (
          <>
            <Label t="Passage title"><input className="field font-normal" value={passageTitle} onChange={(e) => setPassageTitle(e.target.value)} /></Label>
            <Label t="Passage content (simple HTML: p, b, i, u, ul, ol, table; sanitized on the server)"><textarea className="field h-40 py-2 font-mono text-sm font-normal" value={passageHtml} onChange={(e) => setPassageHtml(e.target.value)} /></Label>
          </>
        )}
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Save group</button>
        </div>
      </div>
    </Modal>
  );
}
