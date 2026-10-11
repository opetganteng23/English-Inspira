"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, HBars } from "@/components/Charts";
import { CounselorPanel } from "@/components/CounselorPanel";

type Sec = { section: string; raw: number; total: number; scaled: number };
type Rev = { no: number; section: string; type: string; groupId: string | null; correct: boolean; answered: boolean; stem?: string; options?: string[]; yourChoice?: number | null; answerKey?: number; explanation?: string };
type Topic = { skill: string; topic: string; correct: number; total: number; score: number };
type Analysis = { status: "pending" | "ready" | "failed"; summary?: string; narrative?: string; strengths?: { topic: string; evidence: string }[]; weaknesses?: { title: string; detail: string }[]; gapToTarget?: { target: number; estimated: number; gap: number }; nextSteps?: string[]; mock?: boolean; error?: string };
type R = { levelUp: { up: boolean; reasons: string[]; level?: string } | null; stuck: string[]; kind: string; testName: string; attemptId: string; durationSec: number | null; scoreEst: number; sectionScores: Sec[]; topicScores: Topic[]; flags: number; analysis: Analysis; review: Rev[]; level: { name: string; quota: number; scoreMin: number; scoreMax: number } | null; transcripts: { groupId: string; title: string; text: string }[]; previous: { name: string; scoreEst: number; sectionScores: Sec[]; topicScores: Topic[] } | null; reportId: string | null; recommendations: { skill: string; topic: string; score: number; correct: number; total: number; unit: { id: string; title: string; status: "new" | "in_progress" | "completed" }; course: { id: string; title: string } }[] };

const KIND: Record<string, string> = { placement: "PLACEMENT TEST", sim: "SIMULATION TEST", practice: "PRACTICE" };
const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

const fmtDelta = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "±0");

export default function Hasil({ params }: { params: { id: string } }) {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  const me = useApi<{ targetScore: number | null }>("/api/me");
  const [filter, setFilter] = useState<"all" | "wrong">("wrong");

  useEffect(() => {
    let stop = false, tries = 0;
    const load = async () => {
      try {
        const d: R = await api(`/api/attempts/${params.id}/result`);
        if (stop) return;
        setR(d);
        // Analisis AI berjalan async: cek ulang sampai siap (maks ±1 menit).
        if (d.analysis.status === "pending" && tries++ < 20) setTimeout(load, 3000);
      } catch (e) { if (!stop) setErr((e as Error).message); }
    };
    load();
    return () => { stop = true; };
  }, [params.id]);

  async function retry() {
    try { await api(`/api/attempts/${params.id}/analysis`, { json: {} }); setR((x) => x && { ...x, analysis: { status: "pending" } }); setTimeout(() => location.reload(), 4000); } catch (e) { setErr((e as Error).message); }
  }

  if (err && !r) return <ErrorNote text={err} />;
  if (!r) return <Loading text="Loading results…" />;
  const target = me.data?.targetScore ?? null;
  const a = r.analysis;
  // Mode template: narasi diawali ringkasan yang sama; tampilkan hanya kelanjutannya.
  const extra = a.narrative ? (a.summary && a.narrative.startsWith(a.summary) ? a.narrative.slice(a.summary.length).trim() : a.narrative) : "";
  const shown = r.review.filter((x) => (filter === "wrong" ? !x.correct : true));
  const secDelta = (section: string) => {
    const now = r.sectionScores.find((s) => s.section === section), before = r.previous?.sectionScores.find((s) => s.section === section);
    return now && before ? now.scaled - before.scaled : null;
  };
  const topicBefore = new Map((r.previous?.topicScores ?? []).map((t) => [`${t.skill}|${t.topic}`, t.score]));
  const weakTopics = [...(r.topicScores ?? [])].sort((x, y) => x.score - y.score).slice(0, 8);

  const pctOf = (v: number) => Math.max(0, Math.min(100, ((v - 310) / (677 - 310)) * 100));
  const levelBanners = (
    <>
      {r.levelUp?.up && <section className="card border-success bg-success-tint !p-4"><p className="font-display text-lg font-extrabold text-success">Congratulations, you moved up to the {r.levelUp.level} level!</p><p className="text-sm text-ink-soft">Your new coaching quota and study plan are ready.</p></section>}
      {r.levelUp && !r.levelUp.up && r.levelUp.reasons.length > 0 && <section className="card !p-4"><p className="font-semibold text-navy">Not leveled up yet</p><ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{r.levelUp.reasons.map((x) => <li key={x}>{x}</li>)}</ul></section>}
      {r.stuck?.length > 0 && <section className="card !p-4"><p className="font-semibold text-navy">Topics holding you back</p><p className="text-sm text-ink-soft">{r.stuck.join(", ")}. Try again calmly and ask your coach for help.</p></section>}
      {r.level && (
        <section className="card border-brand bg-brand-tint !p-4">
          <p className="text-xs font-semibold tracking-wider text-brand">YOUR LEVEL</p>
          <p className="font-display text-2xl font-extrabold text-navy">{r.level.name}</p>
          <p className="text-sm text-ink-soft">Score range {r.level.scoreMin}-{r.level.scoreMax} · coaching quota {r.level.quota} sessions. Your level determines which materials and tests are unlocked.</p>
        </section>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-brand">{KIND[r.kind] ?? "TEST"} RESULT</p>
          <h1 className="page-title">{r.testName}</h1>
          {r.durationSec != null && <p className="text-sm text-ink-soft">Finished in {Math.floor(r.durationSec / 60)} min {r.durationSec % 60} sec{r.flags ? ` · ${r.flags} test activity notes` : " · clean session"}</p>}
        </div>
        {r.reportId && <a href={`/api/certificates/${r.reportId}/pdf`} target="_blank" rel="noreferrer" className="btn-outline shrink-0">Download PDF</a>}
      </div>
      <ErrorNote text={err} />

      <section className="grid gap-5 rounded-2xl bg-navy p-5 text-white sm:p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-8">
        <div>
          <p className="text-sm text-[#B9CBE6]">Estimated TOEFL ITP score</p>
          <p className="font-display text-5xl font-extrabold leading-none sm:text-6xl">{r.scoreEst}</p>
          {r.previous && <p className={`mt-2 text-sm font-semibold ${r.scoreEst - r.previous.scoreEst >= 0 ? "text-[#8FE0B0]" : "text-[#FFB4AB]"}`}>{fmtDelta(r.scoreEst - r.previous.scoreEst)} from {r.previous.name} ({r.previous.scoreEst})</p>}
          {target && <p className="mt-1 text-sm font-semibold text-accent">{r.scoreEst >= target ? `Target ${target} reached` : `${target - r.scoreEst} points below the ${target} target`}</p>}
        </div>
        <div>
          <div className="relative mt-5 h-2.5 rounded-full bg-navy-700" aria-hidden>
            <div className="absolute h-2.5 rounded-full bg-[#5B9BEA]" style={{ width: `${pctOf(r.scoreEst)}%` }} />
            {target && <><div className="absolute -top-2 h-6 w-0.5 bg-accent" style={{ left: `${pctOf(target)}%` }} /><span className="absolute -top-6 -translate-x-1/2 text-[11px] font-semibold text-accent" style={{ left: `${pctOf(target)}%` }}>Target {target}</span></>}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-[#B9CBE6]"><span>310</span><span>677</span></div>
          <p className="mt-3 text-xs leading-relaxed text-[#DCE7F7]">An estimate from a simulation test, not an official score. Official scores only come from TOEFL ITP tests run by an official organizer.</p>
        </div>
      </section>

      {levelBanners}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Score per section">
        {r.sectionScores.map((s) => {
          const d = secDelta(s.section);
          return (
            <div key={s.section} className="card !p-4">
              <p className="text-sm font-semibold text-navy">{LABEL[s.section]}</p>
              <p className="mt-1 flex items-baseline gap-2"><span className="font-display text-3xl font-extrabold text-navy">{s.scaled}</span><span className="text-xs text-ink-soft">scale 31-68</span>{d != null && <span className={`ml-auto text-xs font-semibold ${d >= 0 ? "text-success" : "text-red-700"}`}>{fmtDelta(d)}</span>}</p>
              <div className="mt-2 h-2 rounded-full bg-canvas" aria-hidden><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, ((s.scaled - 31) / (68 - 31)) * 100))}%` }} /></div>
              <p className="mt-1.5 text-xs text-ink-soft">{s.raw} of {s.total} correct</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {weakTopics.length > 0 && (
          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Breakdown by question type</h2>
            <p className="text-sm text-ink-soft">Lowest first. Topics with few questions are not enough to draw conclusions.</p>
            <div className="mt-3"><HBars max={100} unit="%" rows={weakTopics.map((t) => ({ label: `${t.topic} (${LABEL[t.skill] ?? t.skill})`, value: Math.round(t.score), sub: `${t.correct}/${t.total}${topicBefore.has(`${t.skill}|${t.topic}`) ? ` · ${fmtDelta(Math.round(t.score - topicBefore.get(`${t.skill}|${t.topic}`)!))}% vs previous` : ""}` }))} /></div>
          </section>
        )}
        <CounselorPanel attemptId={params.id} />
      </div>

      <section className="card">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">AI analysis summary</h2>{a.status === "ready" && a.mock && <span className="badge-muted">basic automatic analysis</span>}</div>
        {a.status === "pending" && <p className="mt-3 text-sm text-ink-soft" role="status">Preparing the analysis… usually under a minute.</p>}
        {a.status === "failed" && <div className="mt-3 text-sm"><p className="text-red-700">{a.error ?? "Analysis not available yet."}</p><button className="btn-outline mt-2" onClick={retry}>Try again</button></div>}
        {a.status === "ready" && (
          <div className="mt-3 grid gap-4 text-sm lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="leading-relaxed">{a.summary}</p>
              {extra && <p className="leading-relaxed text-ink-soft">{extra}</p>}
              {!!a.strengths?.length && <div><p className="font-semibold text-navy">Already strong</p><ul className="mt-1 flex flex-col gap-1 text-ink-soft">{a.strengths.map((x) => <li key={x.topic}><b className="text-navy">{x.topic}</b> · {x.evidence}</li>)}</ul></div>}
              {!!a.nextSteps?.length && <div><p className="font-semibold text-navy">Next steps</p><ol className="mt-1 list-decimal pl-5 text-ink-soft">{a.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol></div>}
            </div>
            {!!a.weaknesses?.length && <div><p className="font-semibold text-navy">Needs strengthening</p><ul className="mt-1 flex flex-col gap-2">{a.weaknesses.map((w) => <li key={w.title} className="rounded-lg bg-canvas p-3"><b className="text-navy">{w.title}</b><br /><span className="text-ink-soft">{w.detail}</span></li>)}</ul></div>}
          </div>
        )}
      </section>

      {r.recommendations?.length > 0 && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Courses to take next</h2>
          <p className="text-sm text-ink-soft">Where you lost points, and the unit that trains that skill.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {r.recommendations.map((x) => (
              <Link key={x.unit.id} href={`/learn/${x.unit.id}`} className="flex flex-col gap-1.5 rounded-xl border border-line p-4 hover:border-brand">
                <span className="flex items-center justify-between gap-2"><span className="badge-warn">{x.score}% in {x.topic}</span><span className="text-xs capitalize text-ink-soft">{LABEL[x.skill] ?? x.skill}</span></span>
                <span className="text-xs text-ink-soft">{x.correct} of {x.total} correct</span>
                <span className="font-semibold text-navy">{x.course.title}</span>
                <span className="text-sm text-ink-soft">Unit: {x.unit.title}</span>
                <span className="mt-auto pt-1 text-sm font-semibold text-brand">{x.unit.status === "completed" ? "Review unit" : x.unit.status === "in_progress" ? "Continue unit" : "Start unit"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-display text-lg font-extrabold text-navy">Answer review</h2><p className="text-sm text-ink-soft">{r.review.length} questions · {r.review.filter((x) => x.correct).length} correct</p></div>
          <div className="flex gap-1 rounded-lg bg-canvas p-1 text-sm" role="tablist">
            {(["wrong", "all"] as const).map((f) => <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 font-semibold ${filter === f ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{f === "wrong" ? "Incorrect" : "All"}</button>)}
          </div>
        </div>
        <ul className="mt-3 grid items-start gap-3 lg:grid-cols-2">
          {shown.map((x) => (
            <li key={x.no} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-navy">Question {x.no} · {LABEL[x.section]} · {x.type}</span><span className={x.correct ? "badge-ok" : "badge-bad"}>{x.correct ? "Correct" : x.answered ? "Incorrect" : "Unanswered"}</span></div>
              <div className="mt-2 text-sm"><p>{x.stem}</p><p className="mt-1 text-ink-soft">Your answer: {x.yourChoice != null ? x.options?.[x.yourChoice] : "-"} · Correct: <b className="text-navy">{x.options?.[x.answerKey!]}</b></p>{x.explanation && <p className="mt-1">{x.explanation}</p>}
                {x.groupId && r.transcripts.some((t) => t.groupId === x.groupId) && (
                  <details className="mt-2 rounded-lg bg-canvas p-3"><summary className="cursor-pointer font-semibold text-navy">Audio transcript</summary><p className="mt-2 whitespace-pre-wrap text-ink-soft">{r.transcripts.find((t) => t.groupId === x.groupId)!.text}</p></details>
                )}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="text-sm text-ink-soft">No questions to show.</li>}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/tests" className="btn-solid">Back to My Tests</Link>
        <Link href="/results" className="btn-outline">All results</Link>
      </div>
    </div>
  );
}
