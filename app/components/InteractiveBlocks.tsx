"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { blockSchemas, normalizeAnswer, type BlockType } from "@/lib/blocks";
import { z } from "zod";

type Report = (itemId: string, correct: boolean) => void;
type Props = { type: BlockType; config: unknown; report: Report };

/** Penampil satu blok interaktif. Konfigurasi sudah divalidasi server; di sini divalidasi ulang sebelum dirender. */
export function InteractiveBlock({ type, config, report }: Props) {
  const parsed = useMemo(() => blockSchemas[type]?.safeParse(config), [type, config]);
  if (!parsed?.success) return null;
  const c = parsed.data as never;
  return (
    <div className="not-prose my-4 rounded-xl border border-line bg-white p-4 text-sm text-ink">
      {type === "quiz" && <Quiz cfg={c} report={report} />}
      {type === "flashcard" && <Flashcards cfg={c} report={report} />}
      {type === "fill" && <Fill cfg={c} report={report} />}
      {type === "match" && <Match cfg={c} report={report} />}
      {type === "timer" && <TimerBlock cfg={c} />}
      {type === "note" && <Note cfg={c} />}
    </div>
  );
}

const Note = ({ cfg }: { cfg: z.infer<typeof blockSchemas.note> }) => (
  <div className={`rounded-lg p-3 ${cfg.kind === "tips" ? "bg-accent-tint text-accent-dark" : "bg-brand-tint text-navy"}`}><b>{cfg.kind === "tips" ? "Tips" : "Note"}</b><p className="mt-1">{cfg.text}</p></div>
);

function Quiz({ cfg, report }: { cfg: z.infer<typeof blockSchemas.quiz>; report: Report }) {
  const [i, setI] = useState(0), [picked, setPicked] = useState<number | null>(null), [score, setScore] = useState(0);
  if (i >= cfg.items.length) return <div><p className="font-semibold text-navy">Done: {score} of {cfg.items.length} correct.</p><button className="btn-outline mt-2 !min-h-[40px]" onClick={() => { setI(0); setScore(0); setPicked(null); }}>Retry</button></div>;
  const it = cfg.items[i];
  return (
    <div>
      <p className="text-xs text-ink-soft">Question {i + 1} of {cfg.items.length}</p>
      <p className="mt-1 font-semibold text-navy">{it.q}</p>
      <div className="mt-2 flex flex-col gap-2">
        {it.options.map((o, k) => (
          <button key={k} disabled={picked !== null} onClick={() => { setPicked(k); const ok = k === it.answer; if (ok) setScore((s) => s + 1); report(`q${i}`, ok); }}
            className={`min-h-[44px] rounded-lg border-[1.5px] px-3 py-2 text-left ${picked === null ? "border-line-strong hover:border-brand" : k === it.answer ? "border-success bg-success-tint" : k === picked ? "border-red-600 bg-red-50" : "border-line"}`}>{"ABCDEF"[k]}. {o}</button>
        ))}
      </div>
      {picked !== null && <button className="btn-solid mt-3 !min-h-[40px]" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 < cfg.items.length ? "Next" : "See score"}</button>}
    </div>
  );
}

function Flashcards({ cfg, report }: { cfg: z.infer<typeof blockSchemas.flashcard>; report: Report }) {
  const [i, setI] = useState(0), [flip, setFlip] = useState(false), [known, setKnown] = useState(0);
  if (i >= cfg.cards.length) return <div><p className="font-semibold text-navy">Done: you know {known} of {cfg.cards.length} cards.</p><button className="btn-outline mt-2 !min-h-[40px]" onClick={() => { setI(0); setKnown(0); setFlip(false); }}>Retry</button></div>;
  const c = cfg.cards[i];
  const answer = (ok: boolean) => { if (ok) setKnown((k) => k + 1); report(`c${i}`, ok); setI(i + 1); setFlip(false); };
  return (
    <div>
      <p className="text-xs text-ink-soft">Card {i + 1} of {cfg.cards.length}</p>
      <button onClick={() => setFlip(!flip)} aria-label="Flip card" className="mt-1 min-h-[96px] w-full rounded-xl border-[1.5px] border-brand bg-brand-tint p-4 text-center font-semibold text-navy">{flip ? c.back : c.front}<span className="mt-1 block text-xs font-normal text-ink-soft">{flip ? "Answer" : "Tap to see the answer"}</span></button>
      {flip && <div className="mt-2 flex gap-2"><button className="btn-solid !min-h-[40px]" onClick={() => answer(true)}>I know it</button><button className="btn-outline !min-h-[40px]" onClick={() => answer(false)}>Not yet</button></div>}
    </div>
  );
}

function Fill({ cfg, report }: { cfg: z.infer<typeof blockSchemas.fill>; report: Report }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const check = () => { setDone(true); cfg.items.forEach((it, i) => report(`f${i}`, ok(it, i))); };
  const ok = (it: (typeof cfg.items)[number], i: number) => it.text.split("___").slice(0, -1).every((_, k) => (it.answers[k] ?? it.answers[0]).split("|").map(normalizeAnswer).includes(normalizeAnswer(vals[`${i}-${k}`] ?? "")));
  return (
    <div className="flex flex-col gap-3">
      {cfg.items.map((it, i) => {
        const parts = it.text.split("___");
        return (
          <p key={i} className="leading-9">
            {parts.map((p, k) => (<span key={k}>{p}{k < parts.length - 1 && <input aria-label={`Blank ${i + 1}.${k + 1}`} disabled={done} className={`mx-1 w-28 rounded-md border-[1.5px] px-2 py-1 ${done ? (ok(it, i) ? "border-success bg-success-tint" : "border-red-600 bg-red-50") : "border-line-strong"}`} value={vals[`${i}-${k}`] ?? ""} onChange={(e) => setVals({ ...vals, [`${i}-${k}`]: e.target.value })} />}</span>))}
            {done && !ok(it, i) && <span className="ml-1 text-xs text-ink-soft">(jawaban: {it.answers.map((a) => a.split("|")[0]).join(", ")})</span>}
          </p>
        );
      })}
      {!done ? <button className="btn-solid self-start !min-h-[40px]" onClick={check}>Check</button> : <button className="btn-outline self-start !min-h-[40px]" onClick={() => { setDone(false); setVals({}); }}>Retry</button>}
    </div>
  );
}

function Match({ cfg, report }: { cfg: z.infer<typeof blockSchemas.match>; report: Report }) {
  const rights = useMemo(() => cfg.pairs.map((p) => p.right).sort(() => Math.random() - 0.5), [cfg]);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  const good = (i: number) => sel[i] === cfg.pairs[i].right;
  const check = () => { setDone(true); cfg.pairs.forEach((_, i) => report(`p${i}`, good(i))); };
  return (
    <div className="flex flex-col gap-2">
      {cfg.pairs.map((p, i) => (
        <label key={i} className="flex flex-wrap items-center gap-2"><span className="min-w-[120px] font-semibold text-navy">{p.left}</span>
          <select disabled={done} className={`field !min-h-[40px] w-auto ${done ? (good(i) ? "border-success" : "border-red-600") : ""}`} value={sel[i] ?? ""} onChange={(e) => setSel({ ...sel, [i]: e.target.value })}><option value="">Choose a match</option>{rights.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          {done && !good(i) && <span className="text-xs text-ink-soft">(answer: {p.right})</span>}
        </label>
      ))}
      {!done ? <button className="btn-solid self-start !min-h-[40px]" onClick={check}>Check</button> : <button className="btn-outline self-start !min-h-[40px]" onClick={() => { setDone(false); setSel({}); }}>Retry</button>}
    </div>
  );
}

function TimerBlock({ cfg }: { cfg: z.infer<typeof blockSchemas.timer> }) {
  const total = cfg.minutes * 60;
  const [left, setLeft] = useState(total), [run, setRun] = useState(false);
  const iv = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (!run) return;
    iv.current = setInterval(() => setLeft((l) => (l <= 1 ? (setRun(false), 0) : l - 1)), 1000);
    return () => clearInterval(iv.current);
  }, [run]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <div className="text-center">
      {cfg.prompt && <p className="mb-2 text-ink-soft">{cfg.prompt}</p>}
      <p className="font-display text-4xl font-extrabold text-navy" role="timer" aria-live="off">{mm}:{ss}</p>
      {left === 0 && <p className="text-success" role="status">Time is up</p>}
      <div className="mt-2 flex justify-center gap-2"><button className="btn-solid !min-h-[40px]" onClick={() => setRun(!run)} disabled={left === 0}>{run ? "Pause" : "Start"}</button><button className="btn-outline !min-h-[40px]" onClick={() => { setRun(false); setLeft(total); }}>Reset</button></div>
    </div>
  );
}
