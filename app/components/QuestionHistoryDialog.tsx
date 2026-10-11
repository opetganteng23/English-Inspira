"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Loading, ErrorNote } from "@/components/Charts";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";

type Ver = { version: number; at: string; changed: string[]; note: string; actor: string; snapshot: Record<string, unknown> };

const NAME: Record<string, string> = { section: "Category", type: "Type", groupId: "Audio/passage group", stem: "Question text", options: "Answer options", answerKey: "Correct answer", explanation: "Explanation", tags: "Tags", difficulty: "Difficulty", status: "Status", source: "Source", assetIds: "Images", created: "Created" };

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (field === "options" && Array.isArray(v)) return v.map((o, i) => `${"ABCDEF"[i]}. ${o}`).join("\n");
  if (field === "answerKey" && typeof v === "number") return "ABCDEF"[v] ?? String(v);
  if (field === "tags" && Array.isArray(v)) return v.length ? v.map((t) => `${(t as { skill: string }).skill}: ${(t as { topic: string }).topic}`).join("; ") : "(none)";
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length === 1 ? "" : "s"}` : "(none)";
  return String(v);
}

/** Riwayat versi soal: siapa mengubah apa dan kapan, perbandingan sebelum dan sesudah, serta pemulihan ke versi lama. */
export function QuestionHistoryDialog({ questionId, onClose, onRestored }: { questionId: string; onClose: () => void; onRestored: () => void }) {
  const { data, loading, error } = useApi<{ versions: Ver[] }>(`/api/admin/questions/${questionId}/versions`);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function restore(version: number) {
    setBusy(true); setErr("");
    try {
      const r = await api(`/api/admin/questions/${questionId}/versions`, { json: { version } });
      if (r.usedInTest) alert("This question is used by a test. Saved results keep the answer key they had when the test was taken.");
      onRestored();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title="Version history" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">Every save is kept. Restoring a version creates a new version, so nothing is ever overwritten.</p>
        <ErrorNote text={error || err} />
        {loading && !data && <Loading />}
        {data?.versions.length === 0 && <p className="rounded-lg bg-canvas p-4 text-sm text-ink-soft">No history yet. Versions appear from the next save.</p>}
        <ol className="flex flex-col gap-2">
          {data?.versions.map((v, i) => {
            const prev = data.versions[i + 1];
            const isOpen = open === v.version;
            return (
              <li key={v.version} className="rounded-xl border border-line">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">v{v.version}</span>
                  {i === 0 && <span className="badge-ok">Current</span>}
                  <span className="text-sm text-ink-soft">{tgl(v.at, true)} · {v.actor}</span>
                  <span className="flex flex-wrap gap-1">{v.changed.map((c) => <span key={c} className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{NAME[c] ?? c}</span>)}</span>
                  {v.note && <span className="text-xs italic text-ink-soft">{v.note}</span>}
                  <span className="ml-auto flex gap-3 text-sm font-semibold">
                    {prev && <button type="button" className="text-brand" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.version)}>{isOpen ? "Hide changes" : "See changes"}</button>}
                    {i > 0 && (confirm === v.version
                      ? <span className="flex items-center gap-2"><button type="button" className="btn-solid !min-h-[34px] !px-3" disabled={busy} onClick={() => restore(v.version)}>{busy ? "Restoring…" : "Yes, restore"}</button><button type="button" className="text-ink-soft" onClick={() => setConfirm(null)}>Cancel</button></span>
                      : <button type="button" className="text-accent-dark" onClick={() => setConfirm(v.version)}>Restore</button>)}
                  </span>
                </div>
                {isOpen && prev && (
                  <div className="grid gap-2 border-t border-line bg-canvas p-3 sm:grid-cols-2">
                    {v.changed.filter((c) => c !== "created").map((c) => (
                      <div key={c} className="contents">
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{NAME[c] ?? c} · before</p><pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-red-800">{show(c, prev.snapshot[c])}</pre></div>
                        <div className="rounded-lg bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{NAME[c] ?? c} · after</p><pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-success">{show(c, v.snapshot[c])}</pre></div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex justify-end"><button className="btn-outline" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  );
}
