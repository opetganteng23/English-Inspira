"use client";

import { useEffect, useState } from "react";
import { CountUp } from "./LandingFx";

const ANSWER = "You are about 53 points short. The fastest gains are in Structure: 5 of your 7 mistakes were subject-verb agreement. Practice 20 questions a day, then retest in 2 weeks.";
const SECTIONS: [string, number, string, string][] = [["Listening", 49, "bg-navy-700", "text-[#B9CBE6]"], ["Structure", 51, "bg-[#5C4310]", "text-[#F6DFA8]"], ["Reading", 49, "bg-navy-700", "text-[#B9CBE6]"]];
const pctScore = (v: number) => ((v - 310) / (677 - 310)) * 100;
const pctSec = (v: number) => ((v - 31) / (68 - 31)) * 100;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Typewriter({ text, startMs }: { text: string; startMs: number }) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (reduced()) return;
    setN(0);
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { iv = setInterval(() => setN((x) => (x >= text.length ? x : x + 2)), 28); }, startMs);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [text, startMs]);
  return <>{text.slice(0, n)}{n < text.length && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-ink" aria-hidden />}</>;
}

/** Kartu contoh hasil + konseling di hero: skor menghitung naik, bar terisi, jawaban AI diketik, lalu diputar ulang. */
export function HeroExample() {
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    const iv = setInterval(() => { if (document.visibilityState === "visible") setRun((r) => r + 1); }, 20000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="fx-float w-full max-w-[520px] shrink-0">
      <div key={run} className="group flex w-full flex-col gap-4 rounded-[20px] bg-navy p-6 text-white shadow-[0_30px_60px_-30px_rgba(15,47,94,0.55)] ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.015]" aria-label="Example result and counseling">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold tracking-wider text-[#B9CBE6]">EXAMPLE RESULT &amp; COUNSELING</span>
          <span className="fx-ring shrink-0 whitespace-nowrap rounded-full bg-[#1B4585] px-2.5 py-1 text-xs text-[#DCE7F7]">Target 550</span>
        </div>
        <div className="flex items-end gap-3.5">
          <span className="font-display text-[56px] font-extrabold leading-none tabular-nums"><CountUp to={497} /></span>
          <span className="pb-1.5 text-sm text-[#B9CBE6]">Estimated ITP score · scale 310-677</span>
        </div>

        <div className="relative pb-5" aria-hidden>
          <div className="h-2 overflow-hidden rounded-full bg-navy-700">
            <div className="fx-fill h-2 rounded-full bg-gradient-to-r from-[#5B9BEA] to-[#8EC0FF]" style={{ "--w": `${pctScore(497)}%` } as React.CSSProperties} />
          </div>
          <span className="fx-pop absolute -top-1 h-4 w-0.5 bg-accent" style={{ left: `${pctScore(550)}%`, "--d": "1300ms" } as React.CSSProperties} />
          <span className="fx-pop absolute top-4 -translate-x-1/2 text-[11px] font-semibold text-accent" style={{ left: `${pctScore(550)}%`, "--d": "1400ms" } as React.CSSProperties}>550</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SECTIONS.map(([l, v, bg, fg], i) => (
            <div key={l} className={`fx-pop flex cursor-default flex-col gap-1 rounded-[10px] p-2.5 transition duration-300 hover:-translate-y-1 hover:brightness-125 ${bg}`} style={{ "--d": `${500 + i * 140}ms` } as React.CSSProperties}>
              <span className={`text-xs ${fg}`}>{l}</span>
              <span className="text-xl font-semibold">{v}</span>
              <span className="h-1 overflow-hidden rounded-full bg-white/15"><span className="fx-fill block h-1 rounded-full bg-white/80" style={{ "--w": `${pctSec(v)}%`, animationDelay: `${900 + i * 140}ms` } as React.CSSProperties} /></span>
            </div>
          ))}
        </div>

        <div className="fx-pop max-w-[360px] self-end rounded-[14px_4px_14px_14px] bg-brand px-3.5 py-3 text-sm leading-normal transition hover:brightness-110" style={{ "--d": "1700ms" } as React.CSSProperties}>What should I do to reach 550?</div>
        <div className="relative flex gap-2.5">
          <span className="fx-pop flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-success-tint text-[11px] font-semibold text-success" style={{ "--d": "2300ms" } as React.CSSProperties}>AI</span>
          <div className="fx-typing absolute left-[40px] top-0 flex items-center gap-1 rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3.5" style={{ "--d": "2300ms" } as React.CSSProperties} aria-hidden>
            {[0, 1, 2].map((d) => <span key={d} className="fx-dot h-1.5 w-1.5 rounded-full bg-ink-soft" style={{ animationDelay: `${d * 160}ms` }} />)}
          </div>
          <div className="fx-pop min-h-[110px] flex-1 rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed text-ink" style={{ "--d": "3500ms" } as React.CSSProperties}>
            <Typewriter text={ANSWER} startMs={3500} />
          </div>
        </div>
      </div>
    </div>
  );
}
