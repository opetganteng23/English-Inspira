"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type Q = { id: string; type: string; groupId: string | null; stem: string; options: string[]; answerKey: number; explanation: string; assetIds: string[] };
type G = { instruction: string; audioId: string | null; passageTitle: string; passageHtml: string; assetIds: string[] };
type Data = { name: string; sections: { name: string; durationSec: number; questions: Q[] }[]; groups: Record<string, G> };
const SECTION: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// Pratinjau tes seperti peserta: pilihan bisa diklik, timer berjalan, skor dihitung di browser. Tidak ada yang disimpan.
export default function TestPreview({ params }: { params: { id: string } }) {
  const { data, error } = useApi<Data>(`/api/admin/tests/${params.id}/preview`);
  const [sec, setSec] = useState(0);
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [review, setReview] = useState(false);

  useEffect(() => { if (data) setLeft(data.sections[sec]?.durationSec ?? 0); }, [data, sec]);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [done, sec]);

  const score = useMemo(() => data?.sections.map((s) => ({ name: s.name, total: s.questions.length, correct: s.questions.filter((q) => ans[q.id] === q.answerKey).length, answered: s.questions.filter((q) => ans[q.id] !== undefined).length })) ?? [], [data, ans]);

  if (error) return <ErrorNote text={error} />;
  if (!data) return <Loading />;
  const back = <Link href={`/admin/tests/${params.id}`} className="text-sm font-semibold text-brand">← Back to test</Link>;
  const banner = <p role="note" className="rounded-xl border border-accent bg-accent-tint p-3 text-sm text-navy"><b>Preview.</b> This is what participants see. Answers and time are not saved and do not count as an attempt.</p>;

  if (done) return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {back}
      <h1 className="page-title">Preview result: {data.name}</h1>
      {banner}
      <div className="grid gap-3 sm:grid-cols-3">
        {score.map((s) => <div key={s.name} className="card"><p className="text-xs font-semibold tracking-wider text-brand">{(SECTION[s.name] ?? s.name).toUpperCase()}</p><p className="font-display text-3xl font-extrabold text-navy">{s.correct}/{s.total}</p><p className="text-xs text-ink-soft">{s.answered} answered · raw score only</p></div>)}
      </div>
      <div className="flex gap-2">
        <button className="btn-solid" onClick={() => setReview(!review)}>{review ? "Hide answers" : "Review answers"}</button>
        <button className="btn-outline" onClick={() => { setAns({}); setSec(0); setIdx(0); setDone(false); setReview(false); }}>Start again</button>
      </div>
      {review && data.sections.map((s) => (
        <section key={s.name} className="card">
          <h2 className="mb-2 font-display text-lg font-extrabold text-navy">{SECTION[s.name] ?? s.name}</h2>
          <ol className="flex flex-col divide-y divide-line text-sm">
            {s.questions.map((q, i) => {
              const ok = ans[q.id] === q.answerKey;
              return <li key={q.id} className="py-2"><p><b className={ok ? "text-success" : "text-red-700"}>{i + 1}. {ok ? "Correct" : ans[q.id] === undefined ? "Not answered" : `Wrong (${"ABCDEF"[ans[q.id]]})`}</b> · key {"ABCDEF"[q.answerKey]}</p><p className="text-ink-soft">{q.stem}</p>{q.explanation && <p className="mt-1 text-xs text-ink-soft">{q.explanation}</p>}</li>;
            })}
          </ol>
        </section>
      ))}
    </div>
  );

  const s = data.sections[sec];
  if (!s || !s.questions.length) return <div className="flex flex-col gap-3">{back}<ErrorNote text="This test has no questions yet." /></div>;
  const q = s.questions[idx];
  const g = q.groupId ? data.groups[q.groupId] : null;
  const last = sec === data.sections.length - 1;
  const nextSection = () => { if (last) setDone(true); else { setSec(sec + 1); setIdx(0); } };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">{back}<span className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${left < 60 ? "bg-red-50 text-red-700" : "bg-canvas text-navy"}`}>{mmss(left)}</span></div>
      {banner}
      <p className="text-xs font-semibold tracking-wider text-brand">{(SECTION[s.name] ?? s.name).toUpperCase()} · SECTION {sec + 1} OF {data.sections.length} · QUESTION {idx + 1} OF {s.questions.length}</p>
      {left === 0 && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Time is up for this section. In the real test it moves on automatically.</p>}
      {g?.audioId && (
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-sm font-semibold text-navy">{g.instruction || "Listen to the audio"}</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio key={g.audioId} controls preload="none" src={`/api/audio/${g.audioId}`} className="mt-2 w-full" />
          <p className="mt-1 text-xs text-ink-soft">In the real test the audio plays once and cannot be paused.</p>
        </div>
      )}
      {g?.passageHtml && (
        <article className="card max-h-72 overflow-y-auto !p-4">
          {g.passageTitle && <h3 className="mb-2 font-display font-extrabold text-navy">{g.passageTitle}</h3>}
          <div className="prose-ei" dangerouslySetInnerHTML={{ __html: g.passageHtml }} />
        </article>
      )}
      <div className="card !p-4">
        <h2 className="text-lg font-medium leading-relaxed">{q.stem}</h2>
        {q.assetIds.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a} src={`/api/assets/${a}`} alt="Question image" className="mt-3 max-h-60 rounded-lg border border-line" />
        ))}
        <div role="radiogroup" aria-label="Answer options" className="mt-4 flex flex-col gap-2.5">
          {q.options.filter((o) => o.trim()).map((o, i) => (
            <button key={i} type="button" role="radio" aria-checked={ans[q.id] === i} onClick={() => setAns({ ...ans, [q.id]: i })}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl border-[1.5px] px-4 py-2.5 text-left transition ${ans[q.id] === i ? "border-brand bg-brand-tint" : "border-line-strong hover:border-brand"}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{"ABCDEF"[i]}</span><span className="min-w-0">{o}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="btn-outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
        {idx < s.questions.length - 1
          ? <button className="btn-solid" onClick={() => setIdx(idx + 1)}>Next</button>
          : <button className="btn-solid" onClick={nextSection}>{last ? "Finish preview" : "Next section"}</button>}
      </div>
      <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
        {s.questions.map((x, i) => (
          <button key={x.id} onClick={() => setIdx(i)} aria-current={i === idx ? "step" : undefined}
            className={`h-8 w-8 rounded-lg text-xs font-semibold ${i === idx ? "bg-navy text-white" : ans[x.id] !== undefined ? "bg-brand-tint text-brand" : "bg-canvas text-ink-soft"}`}>{i + 1}</button>
        ))}
      </nav>
    </div>
  );
}
