"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";

export type QType = { id: string; section: string; name: string; description: string; order: number; active: boolean; count: number };
export const CATEGORY: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

/** Kelola jenis soal per kategori: tambah, ganti nama (soal ikut berubah), nonaktifkan, dan hapus (soal dipindah bila masih dipakai). */
export function QuestionTypesDialog({ types, onClose, onChanged }: { types: QType[]; onClose: () => void; onChanged: () => void }) {
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);
  const [adding, setAdding] = useState<{ section: string; name: string; description: string } | null>(null);
  const [removing, setRemoving] = useState<{ t: QType; moveTo: string } | null>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true); setErr(""); setOk("");
    try { await fn(); setOk(done); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Manage question types" onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-soft">Each category has its own types, for example Listening Part A or Reading Inference. Questions pick a type from this list. Renaming a type updates its questions.</p>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        {ok && <p role="status" className="rounded-lg bg-success-tint p-3 text-sm text-success">{ok}</p>}

        {Object.keys(CATEGORY).map((sec) => {
          const list = types.filter((t) => t.section === sec);
          return (
            <section key={sec} className="rounded-xl border border-line">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
                <h3 className="font-display font-extrabold text-navy">{CATEGORY[sec]} <span className="text-sm font-normal text-ink-soft">· {list.length} type{list.length === 1 ? "" : "s"}</span></h3>
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setAdding({ section: sec, name: "", description: "" })}>+ Add type</button>
              </div>
              <ul className="divide-y divide-line">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {editing?.id === t.id ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <input className="field !h-10" aria-label="Type name" value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                        <input className="field !h-10" aria-label="Description" placeholder="Description (optional)" value={editing.description} maxLength={300} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                        <div className="flex gap-2">
                          <button type="button" className="btn-solid !min-h-[40px]" disabled={busy || !editing.name.trim()} onClick={() => run(async () => { const r = await api(`/api/admin/question-types/${t.id}`, { method: "PATCH", json: { name: editing.name, description: editing.description } }); setEditing(null); if (r.questionsUpdated) setOk(`Renamed. ${r.questionsUpdated} question${r.questionsUpdated > 1 ? "s" : ""} updated.`); }, "Saved.")}>Save</button>
                          <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold ${t.active ? "text-navy" : "text-ink-soft line-through"}`}>{t.name} {!t.active && <span className="badge-muted no-underline">inactive</span>}</p>
                          {t.description && <p className="text-xs text-ink-soft">{t.description}</p>}
                        </div>
                        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-dark">{t.count} question{t.count === 1 ? "" : "s"}</span>
                        <span className="flex gap-3 text-sm font-semibold">
                          <button type="button" className="text-brand" onClick={() => setEditing({ id: t.id, name: t.name, description: t.description })}>Edit</button>
                          <button type="button" className="text-ink-soft" disabled={busy} onClick={() => run(() => api(`/api/admin/question-types/${t.id}`, { method: "PATCH", json: { active: !t.active } }), t.active ? "Deactivated. It no longer appears in the new question form." : "Activated.")}>{t.active ? "Deactivate" : "Activate"}</button>
                          <button type="button" className="text-red-700" onClick={() => (t.count > 0 ? setRemoving({ t, moveTo: "" }) : confirm(`Delete the type "${t.name}"?`) && run(() => api(`/api/admin/question-types/${t.id}`, { method: "DELETE" }), "Deleted."))}>Delete</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
                {list.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No types yet.</li>}
              </ul>
              {adding?.section === sec && (
                <form className="flex flex-col gap-2 border-t border-line bg-brand-tint/40 p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/admin/question-types", { json: { section: adding.section, name: adding.name, description: adding.description || undefined } }); setAdding(null); }, "Type added."); }}>
                  <input className="field !h-10" aria-label="New type name" placeholder="Type name, e.g. Short conversations (Part A)" required maxLength={80} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} autoFocus />
                  <input className="field !h-10" aria-label="New type description" placeholder="Description (optional)" maxLength={300} value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} />
                  <div className="flex gap-2"><button className="btn-solid !min-h-[40px]" disabled={busy || !adding.name.trim()}>Add</button><button type="button" className="btn-outline !min-h-[40px]" onClick={() => setAdding(null)}>Cancel</button></div>
                </form>
              )}
            </section>
          );
        })}

        {removing && (
          <div role="dialog" aria-label="Delete type" className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Delete “{removing.t.name}”?</p>
            <p className="mt-1 text-sm text-red-800">{removing.t.count} question{removing.t.count === 1 ? "" : "s"} use this type. Move them to another type first.</p>
            <select className="field mt-3" aria-label="Move questions to" value={removing.moveTo} onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })}>
              <option value="">Choose the type to move them to</option>
              {types.filter((t) => t.section === removing.t.section && t.id !== removing.t.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-danger" disabled={busy || !removing.moveTo} onClick={() => run(async () => { await api(`/api/admin/question-types/${removing.t.id}?moveTo=${removing.moveTo}`, { method: "DELETE" }); setRemoving(null); }, "Deleted and questions moved.")}>Move questions and delete</button>
              <button type="button" className="btn-outline" onClick={() => setRemoving(null)}>Cancel</button>
            </div>
          </div>
        )}
        <div className="flex justify-end"><button type="button" className="btn-solid" onClick={onClose}>Done</button></div>
      </div>
    </Modal>
  );
}
