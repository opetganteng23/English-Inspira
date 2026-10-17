"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, HBars, Donut, OrderMap, SpeedScatter, ThirdsBars, LineChart } from "@/components/Charts";
import { CounselorPanel } from "@/components/CounselorPanel";
import { buildBreakdown, partLabel } from "@/lib/breakdown";

type Sec = { section: string; raw: number; total: number; scaled: number };
type Rev = { no: number; section: string; type: string; groupId: string | null; correct: boolean; answered: boolean; stem?: string; options?: string[]; yourChoice?: number | null; answerKey?: number; explanation?: string };
type Topic = { skill: string; topic: string; correct: number; total: number; score: number };
type Analysis = { status: "pending" | "ready" | "failed"; summary?: string; narrative?: string; strengths?: { topic: string; evidence: string }[]; weaknesses?: { title: string; detail: string }[]; gapToTarget?: { target: number; estimated: number; gap: number }; nextSteps?: string[]; mock?: boolean; error?: string };
type R = { levelUp: { up: boolean; reasons: string[]; level?: string } | null; stuck: string[]; kind: string; testName: string; attemptId: string; durationSec: number | null; scoreEst: number; sectionScores: Sec[]; topicScores: Topic[]; flags: number; analysis: Analysis; review: Rev[]; level: { name: string; quota: number; scoreMin: number; scoreMax: number; info: { summary: string; traits: string } | null } | null; equivalents?: { itp: number; cefr: string; cefrLabel: string } | null; transcripts: { groupId: string; title: string; text: string }[]; previous: { name: string; scoreEst: number; sectionScores: Sec[]; topicScores: Topic[] } | null; reportId: string | null; insights?: Insights; summary?: Summary; unanswered?: { total: number; unanswered: number; pct: number; sections: { section: string; total: number; unanswered: number; trailing: number }[]; types: { skill: string; topic: string; unanswered: number; total: number }[]; advice: string[] }; scoring?: { name: string | null; version: number | null; basis: "verified" | "provisional" }; recommendations: { skill: string; topic: string; score: number; correct: number; total: number; unit: { id: string; title: string; status: "new" | "in_progress" | "completed" }; course: { id: string; title: string } }[] };

import type { Insights } from "@/lib/insights";
import type { Summary } from "@/lib/summary";
const BD_LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const KIND: Record<string, string> = { placement: "PLACEMENT TEST", sim: "SIMULATION TEST", practice: "PRACTICE" };
const LABEL: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

const fmtDelta = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "±0");

export default function Hasil({ params }: { params: { id: string } }) {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  const [releaseAt, setReleaseAt] = useState<Date | null>(null);
  const me = useApi<{ targetScore: number | null }>("/api/me");
  const hist = useApi<{ attempts: { id: string; name: string; status: string; finishedAt: string | null; scoreEst: number | null; availableAt?: string | null }[] }>("/api/attempts");
  const [filter, setFilter] = useState<"all" | "wrong">("wrong");
  const [bdTab, setBdTab] = useState("");

  useEffect(() => {
    let stop = false, tries = 0;
    const load = async () => {
      try {
        const d: R = await api(`/api/attempts/${params.id}/result`);
        if (stop) return;
        setR(d);
        // Analisis AI berjalan async dan diantre bila banyak peserta mengirim bersamaan: cek ulang sampai siap (maks ±3 menit).
        if (d.analysis.status === "pending" && tries++ < 60) setTimeout(load, 3000);
      } catch (e) {
        if (stop) return;
        const x = e as { status?: number; data?: { availableAt?: string } };
        // Hasil ditahan sampai waktu rilis: tampilkan penantian dan cek lagi berkala.
        if (x.status === 423 && x.data?.availableAt) { setReleaseAt(new Date(x.data.availableAt)); setTimeout(load, 30000); }
        else setErr((e as Error).message);
      }
    };
    load();
    return () => { stop = true; };
  }, [params.id]);

  async function retry() {
    try { await api(`/api/attempts/${params.id}/analysis`, { json: {} }); setR((x) => x && { ...x, analysis: { status: "pending" } }); setTimeout(() => location.reload(), 4000); } catch (e) { setErr((e as Error).message); }
  }

  if (releaseAt && !r) {
    const mins = Math.max(0, Math.ceil((+releaseAt - Date.now()) / 60000));
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-10 text-center">
        <p className="text-xs font-semibold tracking-wider text-brand">TEST SUBMITTED</p>
        <h1 className="page-title">Your result is being prepared</h1>
        <p className="text-ink-soft">Your answers have been saved. Results are released together at <b className="text-navy">{releaseAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB</b>{mins > 0 ? `, in about ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}` : ""}. This page checks automatically, so you can leave it open or come back later.</p>
        <div className="flex justify-center gap-2"><Link href="/home" className="btn-outline">Back to Home</Link></div>
      </div>
    );
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
  const breakdown = buildBreakdown(r.topicScores ?? [], r.previous?.topicScores);
  const bd = breakdown.find((g) => g.key === bdTab) ?? breakdown[0];

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
        <div className="flex shrink-0 flex-wrap gap-2">
          {r.analysis.status === "pending"
            ? <span className="btn-solid cursor-not-allowed opacity-60" role="note" title="The PDF includes the analysis, so it is available once the analysis is ready">Export results (PDF)<span className="ml-2 text-xs font-normal">analysis preparing…</span></span>
            : <a href={`/api/attempts/${params.id}/pdf`} download className="btn-solid">Export results (PDF)</a>}
          {r.reportId && <a href={`/api/certificates/${r.reportId}/pdf`} target="_blank" rel="noreferrer" className="btn-outline">Report with QR (PDF)</a>}
        </div>
      </div>
      <ErrorNote text={err} />

      <section className="grid gap-5 rounded-2xl bg-navy p-5 text-white sm:p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-8">
        <div>
          <p className="text-sm text-[#B9CBE6]">Estimated EPTA score</p>
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
          <p className="mt-3 text-xs leading-relaxed text-[#DCE7F7]">An estimate from a simulation test, not an official score. Official scores only come from official EPTA tests run by an official organizer.</p>
          {r.scoring && <p className={`mt-2 inline-block rounded-md px-2 py-1 text-[11px] font-semibold ${r.scoring.basis === "verified" ? "bg-white/15 text-[#DCE7F7]" : "bg-accent text-navy"}`}>{r.scoring.basis === "verified" ? `Scored with a verified conversion${r.scoring.name ? `: ${r.scoring.name}` : ""}` : "Provisional conversion: treat this score as a rough estimate"}</p>}
        </div>
      </section>

      {r.summary && (() => {
        const sm = r.summary;
        const tone = sm.reliability.level === "high" ? "border-success bg-success-tint" : sm.reliability.level === "medium" ? "border-accent bg-accent-tint" : "border-red-300 bg-red-50";
        const badge = sm.reliability.level === "high" ? "bg-success text-white" : sm.reliability.level === "medium" ? "bg-accent text-navy" : "bg-red-700 text-white";
        const unitFor = (skill: string, topic: string) => r.recommendations?.find((x) => x.skill === skill && x.topic === topic);
        return (
          <section className="flex flex-col gap-4" aria-label="Diagnostic summary">
            <div className={`rounded-xl border p-4 ${tone}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${badge}`}>Reliability: {sm.reliability.level}</span><b className="text-navy">{sm.reliability.headline}.</b></p>
              <p className="mt-1 text-sm text-ink-soft">{sm.reliability.detail}</p>
              {sm.pace.avgSec != null && sm.pace.realSec != null && <p className="mt-1 text-xs text-ink-soft">Your average was {sm.pace.avgSec}s per answer; the real test pace is about {sm.pace.realSec}s per question.</p>}
            </div>
            {sm.level.next && (
              <div className="card">
                <h2 className="font-display text-lg font-extrabold text-navy">Gap to {sm.level.next.name} ({sm.level.next.scoreMin})</h2>
                <p className="text-sm text-ink-soft">{sm.level.next.scoreMin} needs a section average of {sm.level.next.avgNeeded} (scale 31-68).</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {sm.gap.map((g) => (
                    <li key={g.section} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                      <span className="font-semibold text-navy">{BD_LABEL[g.section] ?? g.section}</span>
                      <span className="relative h-3 rounded-full bg-canvas" aria-hidden><span className="absolute h-3 rounded-full bg-navy" style={{ width: `${Math.max(2, ((g.scaled - 31) / 37) * 100)}%` }} /><span className="absolute -top-1 h-5 w-0.5 bg-accent" style={{ left: `${((sm.level.next!.avgNeeded - 31) / 37) * 100}%` }} /></span>
                      <span className={`text-xs font-semibold ${g.gap > 0 ? "text-red-700" : "text-success"}`}>{g.scaled} · {g.gap > 0 ? `+${g.gap} needed` : "on target"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sm.priorities.length > 0 && (
              <div className="card">
                <h2 className="font-display text-lg font-extrabold text-navy">Your top {sm.priorities.length} priorities</h2>
                <p className="text-sm text-ink-soft">Ranked by how many questions of that type you can win back in this test. Based only on this test.</p>
                <ol className="mt-3 grid gap-3 md:grid-cols-3">
                  {sm.priorities.map((p, k) => (
                    <li key={`${p.skill}|${p.topic}`} className="rounded-xl border-t-4 border-red-600 bg-canvas p-3 text-sm">
                      <p className="font-semibold text-navy">{k + 1}. {p.topic}</p>
                      <p className="text-xs text-ink-soft">{BD_LABEL[p.skill === "grammar" ? "structure" : p.skill] ?? p.skill} · {p.score}% · {p.correct}/{p.total} · about {p.recoverable} questions to win back</p>
                      <p className="mt-1 text-ink-soft">{p.tip}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">Priority {sm.zones.priority}</span><span className="rounded-full bg-accent-tint px-3 py-1 font-semibold text-navy">Developing {sm.zones.developing}</span><span className="rounded-full bg-success-tint px-3 py-1 font-semibold text-success">Strong {sm.zones.strong}</span>{sm.zones.few > 0 && <span className="rounded-full bg-canvas px-3 py-1 text-ink-soft">Too few questions {sm.zones.few}</span>}</p>
              </div>
            )}
            <div className="card">
              <h2 className="font-display text-lg font-extrabold text-navy">Recommended next steps</h2>
              <p className="text-sm text-ink-soft">About 20 minutes a day.</p>
              <table className="mt-2 w-full text-left text-sm"><thead><tr className="border-b-2 border-navy text-xs uppercase text-ink-soft"><th className="py-1.5 pr-3">When</th><th className="py-1.5 pr-3">Focus</th><th className="py-1.5">What to do</th></tr></thead>
                <tbody>{sm.plan.map((x) => { const u = x.topic ? unitFor(x.topic.skill, x.topic.topic) : undefined; return <tr key={x.when} className="border-b border-line align-top"><td className="py-2 pr-3 font-semibold text-navy">{x.when}</td><td className="py-2 pr-3">{x.focus}</td><td className="py-2 text-ink-soft">{x.action}{u && <> <Link href={`/learn/${u.unit.id}`} className="font-semibold text-brand">Open unit: {u.unit.title}</Link></>}</td></tr>; })}</tbody></table>
            </div>
          </section>
        );
      })()}

      {r.equivalents && (
        <section className="card" aria-label="Score equivalents">
          <h2 className="font-display text-lg font-extrabold text-navy">Score equivalents</h2>
          {r.level?.info && <p className="mt-1 text-sm text-ink"><b>{r.level.name} ({r.level.scoreMin} to {r.level.scoreMax}).</b> {r.level.info.summary} {r.level.info.traits}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-canvas p-3"><dt className="text-xs font-semibold uppercase text-ink-soft">EPTA</dt><dd className="font-display text-2xl font-extrabold text-navy">{r.equivalents.itp}</dd><dd className="text-xs text-ink-soft">estimate, 310 to 677</dd></div>
            <div className="rounded-xl bg-canvas p-3"><dt className="text-xs font-semibold uppercase text-ink-soft">CEFR</dt><dd className="font-display text-2xl font-extrabold text-navy">{r.equivalents.cefr}</dd><dd className="text-xs text-ink-soft">{r.equivalents.cefrLabel.replace(/^\S+ /, "")}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">CEFR follows the standard mapping for the 310-677 scale. Equivalents are guides for placement, not official scores.</p>
        </section>
      )}

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
        {bd && (
          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Breakdown by question type</h2>
            <p className="text-sm text-ink-soft">Every question type in each section, lowest first. Types with fewer than 3 questions are marked: too few to draw conclusions.</p>
            <div className="mt-3 flex flex-wrap gap-1 rounded-lg bg-canvas p-1 text-sm" role="tablist" aria-label="Section">
              {breakdown.map((g) => <button key={g.key} role="tab" aria-selected={bd.key === g.key} onClick={() => setBdTab(g.key)} className={`rounded-md px-3 py-1.5 font-semibold ${bd.key === g.key ? "bg-white text-navy shadow-sm" : "text-ink-soft"}`}>{g.label}</button>)}
            </div>
            {bd.parts.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft"><span className="font-semibold text-navy">By part:</span>{bd.parts.map((p) => <span key={p.topic} className="rounded-full bg-canvas px-3 py-1 font-semibold text-navy">{partLabel(p.topic)} · {p.correct}/{p.total} ({Math.round(p.score)}%)</span>)}</p>}
            <div className="mt-3"><HBars max={100} unit="%" rows={bd.rows.map((t) => ({ label: `${t.topic}${t.few ? " (few questions)" : ""}`, value: Math.round(t.score), sub: `${t.correct}/${t.total}${t.delta != null ? ` · ${fmtDelta(t.delta)}% vs previous` : ""}` }))} /></div>
          </section>
        )}
        <CounselorPanel attemptId={params.id} />
      </div>

      <section className="card">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">{r.kind === "placement" ? "Analysis of this placement test" : "AI analysis summary"}</h2>{a.status === "ready" && a.mock && <span className="badge-muted">basic automatic analysis</span>}</div>
        {a.status === "pending" && <p className="mt-3 text-sm text-ink-soft" role="status">Preparing the analysis… this can take a few minutes when many people finish at the same time.</p>}
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

      {(() => {
        const pts = (hist.data?.attempts ?? []).filter((x) => x.status === "submitted" && !x.availableAt && x.scoreEst != null).reverse();
        return pts.length >= 2 ? (
          <section className="card">
            <h2 className="font-display text-lg font-extrabold text-navy">Your score over time</h2>
            <p className="text-sm text-ink-soft">Every finished test, oldest to newest.</p>
            <LineChart points={pts.map((x) => ({ label: x.name, value: x.scoreEst as number }))} target={target} />
          </section>
        ) : null;
      })()}

      {r.insights && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">How you answered</h2>
          <div className="mt-3 grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex items-center gap-4">
              <Donut parts={[{ label: "Correct", value: r.insights.outcome.total.correct, color: "#1E8E5A" }, { label: "Wrong", value: r.insights.outcome.total.wrong, color: "#C0392B" }, { label: "Blank", value: r.insights.outcome.total.blank, color: "#9AA8BC" }]} />
              <ul className="text-sm text-ink-soft"><li><b className="text-success">{r.insights.outcome.total.correct}</b> correct</li><li><b className="text-red-700">{r.insights.outcome.total.wrong}</b> wrong</li><li><b className="text-navy">{r.insights.outcome.total.blank}</b> blank</li></ul>
            </div>
            <OrderMap rows={r.insights.order.map((o) => ({ label: `${BD_LABEL[o.section] ?? o.section}, in the order you saw the questions`, marks: o.marks }))} />
          </div>
          {r.insights.stamina.length > 0 && <div className="mt-5"><h3 className="font-semibold text-navy">Stamina: accuracy through each section</h3><div className="mt-2"><ThirdsBars rows={r.insights.stamina.map((x) => ({ label: BD_LABEL[x.section] ?? x.section, thirds: x.thirds }))} /></div></div>}
          {r.insights.quadrants.length > 0 && (
            <div className="mt-5">
              <h3 className="font-semibold text-navy">Speed versus accuracy by question type</h3>
              <p className="text-xs text-ink-soft">Each dot is a question type (at least 3 questions). Dashed lines mark the median time and 70% accuracy.</p>
              <SpeedScatter points={r.insights.quadrants.map((q) => ({ label: q.topic, ...q }))} />
              <ul className="mt-2 grid gap-1 text-sm text-ink-soft sm:grid-cols-2">{r.insights.quadrants.filter((q) => q.kind !== "solid").slice(0, 6).map((q) => <li key={`${q.skill}|${q.topic}`}><b className="text-navy">{q.topic}</b> · {q.kind === "concept" ? "slow and often wrong: review the concept" : q.kind === "rushed" ? "quick but often wrong: slow down" : "accurate but slow: practise under time"} ({q.avgSec}s, {q.accuracy}%)</li>)}</ul>
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {r.insights.time && <div className="rounded-xl bg-canvas p-3 text-sm"><p className="font-semibold text-navy">Time per question</p><ul className="mt-1 text-ink-soft">{r.insights.time.sections.map((x) => <li key={x.section}>{BD_LABEL[x.section] ?? x.section}: {x.avgSec}s on average</li>)}</ul></div>}
            {r.insights.changes && <div className="rounded-xl bg-canvas p-3 text-sm"><p className="font-semibold text-navy">Changed answers</p><p className="mt-1 text-ink-soft">{r.insights.changes.changed === 0 ? "You did not change any answer." : `${r.insights.changes.changed} changed: ${r.insights.changes.toRight} became right, ${r.insights.changes.toWrong} became wrong, ${r.insights.changes.stillWrong} stayed wrong.`}</p></div>}
            {r.insights.guessing && <div className="rounded-xl bg-canvas p-3 text-sm"><p className="font-semibold text-navy">Likely guesses</p><p className="mt-1 text-ink-soft">{r.insights.guessing.count} questions answered in under 5 seconds and missed ({r.insights.guessing.pct}%).</p></div>}
          </div>
          {r.insights.advice.length > 0 && <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft">{r.insights.advice.map((t) => <li key={t}>{t}</li>)}</ul>}
        </section>
      )}

      {r.unanswered && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Unanswered questions</h2>
          <p className="mt-1 text-sm">{r.unanswered.unanswered === 0 ? `You answered all ${r.unanswered.total} questions.` : <><b className="text-navy">{r.unanswered.unanswered} of {r.unanswered.total}</b> questions ({r.unanswered.pct}%) were left blank and counted as wrong.</>}</p>
          {r.unanswered.unanswered > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {r.unanswered.sections.filter((s) => s.unanswered > 0).map((s) => <span key={s.section} className="rounded-full bg-canvas px-3 py-1 font-semibold text-navy">{BD_LABEL[s.section] ?? s.section} · {s.unanswered}/{s.total}{s.trailing >= 3 ? ` · last ${s.trailing} blank` : ""}</span>)}
              {r.unanswered.types.map((t) => <span key={`${t.skill}|${t.topic}`} className="rounded-full bg-canvas px-3 py-1 text-ink-soft">{t.topic} · {t.unanswered}/{t.total}</span>)}
            </div>
          )}
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft">{r.unanswered.advice.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

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

      {r.review.length > 0 && <section className="card">
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
      </section>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/tests" className="btn-solid">Back to My Tests</Link>
        <Link href="/results" className="btn-outline">All results</Link>
      </div>
    </div>
  );
}
