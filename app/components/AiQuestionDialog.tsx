"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import type { QType } from "@/components/QuestionTypesDialog";

type Draft = { stem: string; options: string[]; answerKey: number; explanation: string; duplicate: boolean };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Draf soal Structure & Written Expression dari Claude. Tidak ada yang tersimpan sebelum ditinjau dan dipilih; hasilnya berstatus draft. */
export function AiQuestionDialog({ types, onClose, onSaved }: { types: QType[]; onClose: () => void; onSaved: () => void }) {
  const status = useApi<{ enabled: boolean }>("/api/admin/questions/generate");
  const structure = types.filter((t) => t.section === "structure" && t.active);
  const [v, setV] = useState({ type: structure[0]?.name ?? "", skill: "structure", topic: "", difficulty: "medium", count: 5, notes: "" });
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true); setErr(""); setNote(""); setDrafts(null);
    try {
      const d = await api<{ drafts: Draft[]; dropped: number; truncated: boolean }>("/api/admin/questions/generate", { json: { section: "structure", ...v, count: Number(v.count), notes: v.notes || undefined } });
      setDrafts(d.drafts);
      setPicked(new Set(d.drafts.map((x, i) => (x.duplicate ? -1 : i)).filter((i) => i >= 0)));
      setNote([d.dropped ? `${d.dropped} invalid item${d.dropped > 1 ? "s were" : " was"} discarded.` : "", d.truncated ? "The answer was cut short; some questions may be missing." : "", d.drafts.length === 0 ? "No usable questions came back. Try again." : ""].filter(Boolean).join(" "));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    if (!drafts) return;
    setBusy(true); setErr("");
    let n = 0;
    try {
      for (const i of [...picked].sort((a, b) => a - b)) {
        const d = drafts[i];
        await api("/api/admin/questions", { json: { section: "structure", type: v.type, stem: d.stem, options: d.options, answerKey: d.answerKey, explanation: d.explanation, difficulty: v.difficulty, tags: [{ skill: v.skill, topic: v.topic }], status: "draft", source: "AI draft, needs review" } });
        n++;
      }
      onSaved();
    } catch (e) { setErr(`${(e as Error).message}${n ? ` (${n} saved before the error)` : ""}`); setBusy(false); if (n) onSaved(); }
  }

  return (
    <Modal title="Draft questions with AI" onClose={onClose} wide>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">Claude writes original Structure and Written Expression questions for you to review. Nothing is saved until you choose questions, and they are saved as <b>draft</b>. Always check the answer key and wording before publishing. Listening and Reading questions need audio or a passage, so write those manually.</p>
        {status.data && !status.data.enabled && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">AI is not configured on this server. Ask the administrator to set the API key.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Question type<select className="field font-normal" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{structure.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
          <label className={label}>Difficulty<select className="field font-normal" value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label className={label}>Skill tag<input className="field font-normal" value={v.skill} onChange={(e) => setV({ ...v, skill: e.target.value })} /></label>
          <label className={label}>Topic tag<input className="field font-normal" placeholder="Example: subject-verb agreement" value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value })} /></label>
          <label className={label}>How many (1 to 10)<input className="field font-normal" type="number" min={1} max={10} value={v.count} onChange={(e) => setV({ ...v, count: Number(e.target.value) })} /></label>
          <label className={label}>Extra guidance (optional)<input className="field font-normal" maxLength={500} placeholder="Example: academic topics, avoid names" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></label>
        </div>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{err}</p>}
        {note && <p role="status" className="rounded-lg bg-canvas p-3 text-ink-soft">{note}</p>}
        <div><button className="btn-solid" disabled={busy || !v.topic.trim() || !v.skill.trim() || !v.type || status.data?.enabled === false} onClick={generate}>{busy && !drafts ? "Writing…" : drafts ? "Generate again" : "Generate drafts"}</button></div>

        {drafts && drafts.length > 0 && (
          <>
            <ul className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto" aria-label="Drafted questions">
              {drafts.map((d, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={picked.has(i)} aria-label={`Select question ${i + 1}`} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                    <span className="min-w-0">
                      <b className="text-navy">{d.stem}</b>{d.duplicate && <span className="badge-warn ml-2">looks like an existing question</span>}
                      <ol className="mt-1 list-[upper-alpha] pl-5">{d.options.map((o, k) => <li key={k} className={k === d.answerKey ? "font-semibold text-success" : ""}>{o}{k === d.answerKey ? " (answer)" : ""}</li>)}</ol>
                      {d.explanation && <span className="mt-1 block text-xs text-ink-soft">{d.explanation}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Close</button><button className="btn-solid" disabled={busy || picked.size === 0} onClick={save}>{busy ? "Saving…" : `Save ${picked.size} as draft`}</button></div>
          </>
        )}
      </div>
    </Modal>
  );
}
