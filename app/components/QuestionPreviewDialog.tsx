"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";

type Group = { instruction?: string; passageTitle?: string; passageHtml?: string; audioId?: string };
export type PreviewQuestion = { section: string; type: string; groupId: string; stem: string; options: string[]; answerKey: number; explanation: string; assetIds: string[] };
const CATEGORY: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

/** Pratinjau soal persis seperti peserta melihatnya (passage, audio, pilihan). Pilihan bisa diklik; "Show answer" khusus admin. */
export function QuestionPreviewDialog({ q, onClose }: { q: PreviewQuestion; onClose: () => void }) {
  const [g, setG] = useState<Group | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { if (q.groupId) api(`/api/admin/groups/${q.groupId}`).then((d) => setG(d)).catch(() => setG(null)); }, [q.groupId]);
  const clean = q.options.filter((o) => o.trim());

  return (
    <Modal title="Preview as participant" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-canvas p-4">
          <p className="text-xs font-semibold tracking-wider text-brand">{CATEGORY[q.section] ?? q.section}{q.type ? ` · ${q.type}` : ""}</p>
          {g?.audioId && (
            <div className="mt-3 rounded-xl border border-line bg-white p-3">
              <p className="text-sm font-semibold text-navy">{g.instruction || "Listen to the audio"}</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" src={`/api/audio/${g.audioId}`} className="mt-2 w-full" />
              <p className="mt-1 text-xs text-ink-soft">In the real test the audio plays once and cannot be paused.</p>
            </div>
          )}
          {g?.passageHtml && (
            <article className="card mt-3 max-h-56 overflow-y-auto !p-4">
              {g.passageTitle && <h3 className="mb-2 font-display font-extrabold text-navy">{g.passageTitle}</h3>}
              <div className="prose-ei" dangerouslySetInnerHTML={{ __html: g.passageHtml }} />
            </article>
          )}
          <div className="card mt-3 !p-4">
            <h2 className="text-lg font-medium leading-relaxed">{q.stem || <span className="text-ink-soft">(question text is empty)</span>}</h2>
            {q.assetIds.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a} src={`/api/assets/${a}`} alt="Question image" className="mt-3 max-h-60 rounded-lg border border-line" />
            ))}
            <div role="radiogroup" aria-label="Answer options" className="mt-4 flex flex-col gap-2.5">
              {clean.map((o, i) => (
                <button key={i} type="button" role="radio" aria-checked={pick === i} onClick={() => setPick(i)}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xl border-[1.5px] px-4 py-2.5 text-left transition ${pick === i ? "border-brand bg-brand-tint" : "border-line-strong hover:border-brand"} ${reveal && i === q.answerKey ? "!border-success !bg-success-tint" : ""}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{"ABCDEF"[i]}</span><span className="min-w-0">{o}</span>
                </button>
              ))}
              {clean.length < 2 && <p className="text-sm text-red-700">Add at least two answer options.</p>}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-line-strong p-3">
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setReveal(!reveal)}>{reveal ? "Hide answer (admin only)" : "Show answer and explanation (admin only)"}</button>
          {reveal && <p className="mt-2 text-sm"><b className="text-navy">Correct answer: {"ABCDEF"[q.answerKey] ?? "-"}.</b> {q.explanation || <span className="text-ink-soft">No explanation yet.</span>}</p>}
        </div>
        <div className="flex justify-end"><button className="btn-solid" onClick={onClose}>Close preview</button></div>
      </div>
    </Modal>
  );
}
