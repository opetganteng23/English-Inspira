"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/Charts";

type Q = { no: number; qid: string; type: string; topic: string; timeSec: number; changes: number; answered: boolean; correct: boolean | null; guess: boolean; flagged: boolean; events: number };
type S = { name: string; durationSec: number; questions: Q[]; totalSec: number; medianSec: number };
type E = { kind: string; at: string; minute: number; section: number | null; no: number | null };
type D = {
  participant: { id: string; name: string; email: string };
  attempt: { id: string; status: string; startedAt: string; finishedAt: string | null; scoreEst: number | null; review: { status?: string; note?: string } | null };
  test: { name: string; secure: boolean };
  sections: S[]; events: E[];
  summary: { tabHidden: number; fullscreenExit: number; paste: number; guesses: number; changed: number; unanswered: number; slowest: { section: string; no: number; timeSec: number; correct: boolean | null }[]; minutes: number | null };
};
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const EV: Record<string, string> = { tab_hidden: "Switched tab / app", fullscreen_exit: "Left fullscreen", paste: "Paste", multi_tab: "Opened in another tab" };
const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const clock = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });

/** Proctoring per soal: lama di tiap soal, benar/salah, ganti jawaban, tebakan, dan kejadian pindah tab/keluar layar penuh beserta nomor soalnya. */
export function ActivityTimeline({ attemptId, back }: { attemptId: string; back: { href: string; label: string } }) {
  const { data: d, error, loading } = useApi<D>(`/api/staff/attempts/${attemptId}/activity`);
  if (loading && !d) return <Loading />;
  if (!d) return <ErrorNote text={error} />;
  const s = d.summary;
  const stat = (label: string, v: number | string, warn = false) => (
    <div className={`card !p-4 ${warn ? "border-accent bg-accent-tint" : ""}`}><p className="text-xs font-semibold tracking-wider text-ink-soft">{label}</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{v}</p></div>
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={back.href} className="text-sm font-semibold text-brand">{back.label}</Link>
        <p className="mt-1 text-xs font-semibold tracking-wider text-brand">ACTIVITY TIMELINE · PROCTORING</p>
        <h1 className="page-title">{d.participant.name}</h1>
        <p className="text-sm text-ink-soft">{d.participant.email} · {d.test.name} · {tgl(d.attempt.startedAt, true)}{d.attempt.finishedAt ? ` to ${clock(d.attempt.finishedAt)} WIB` : " · in progress"}{s.minutes != null ? ` · ${s.minutes} min` : ""}{d.attempt.scoreEst != null ? ` · score ${d.attempt.scoreEst}` : ""}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat("TAB / APP SWITCHES", s.tabHidden, s.tabHidden > 0)}
        {stat("LEFT FULLSCREEN", s.fullscreenExit, s.fullscreenExit > 0)}
        {stat("PASTE", s.paste, s.paste > 0)}
        {stat("LIKELY GUESSES", s.guesses, s.guesses >= 10)}
        {stat("ANSWERS CHANGED", s.changed)}
        {stat("UNANSWERED", s.unanswered, s.unanswered > 0)}
      </div>

      {d.sections.map((sec, si) => {
        const max = Math.max(1, ...sec.questions.map((q) => q.timeSec));
        return (
          <section key={si} className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold text-navy">{SEC[sec.name] ?? sec.name}: time per question</h2>
              <p className="text-sm text-ink-soft">{fmt(sec.totalSec)} on questions · median {fmt(sec.medianSec)} per question · limit {Math.round(sec.durationSec / 60)} min</p>
            </div>
            <div className="flex h-44 items-end gap-[3px] rounded-lg border border-line bg-canvas px-2 pt-6" role="img" aria-label={`Time spent per question in ${SEC[sec.name] ?? sec.name}`}>
              {sec.questions.map((q) => (
                <div key={q.qid} className="relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`Q${q.no} · ${fmt(q.timeSec)} · ${q.answered ? (q.correct ? "correct" : "wrong") : "blank"}${q.changes ? ` · changed ${q.changes}×` : ""}${q.guess ? " · likely guess" : ""}${q.events ? ` · ${q.events} event(s)` : ""}`}>
                  {q.events > 0 && <span className="absolute -top-5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent" aria-hidden />}
                  <div className={`w-full rounded-t ${!q.answered ? "bg-line-strong" : q.correct ? "bg-success" : "bg-red-600"} ${q.guess ? "opacity-60" : ""}`} style={{ height: `${Math.max(3, (q.timeSec / max) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
              <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-success align-middle" />correct</span>
              <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-red-600 align-middle" />wrong</span>
              <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-line-strong align-middle" />blank</span>
              <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-accent align-middle" />tab switch / left fullscreen on this question</span>
              <span>faded bar = likely guess (under 5s and wrong) · bar height = time spent</span>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-brand">Question details</summary>
              <div className="table-wrap mt-3"><table>
                <thead><tr><th>No</th><th>Type</th><th>Time</th><th>Result</th><th>Changed</th><th>Notes</th></tr></thead>
                <tbody>{sec.questions.map((q) => (
                  <tr key={q.qid}>
                    <td className="font-semibold text-navy">{q.no}</td><td>{q.topic || q.type || "-"}</td><td>{fmt(q.timeSec)}</td>
                    <td>{!q.answered ? <span className="badge-muted">Blank</span> : q.correct ? <span className="badge-ok">Correct</span> : <span className="badge-bad">Wrong</span>}</td>
                    <td>{q.changes ? `${q.changes}×` : "-"}</td>
                    <td className="text-xs">{[q.guess && "likely guess", q.events && `${q.events} event(s)`, q.timeSec > sec.medianSec * 3 && sec.medianSec > 0 && "much longer than usual"].filter(Boolean).join(" · ") || "-"}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </details>
          </section>
        );
      })}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Events</h2>
          <p className="text-sm text-ink-soft">Every tab switch, fullscreen exit and paste, with the time and the question on screen.</p>
          {d.events.length ? (
            <ol className="mt-3 flex flex-col divide-y divide-line">{d.events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><b className="text-navy">{EV[e.kind] ?? e.kind}</b><span className="block text-xs text-ink-soft">{e.section != null ? `${SEC[d.sections[e.section]?.name] ?? "Section"}${e.no ? ` · question ${e.no}` : ""}` : "Section not recorded"} · minute {e.minute}</span></span>
                <span className="font-semibold text-navy tabular-nums">{clock(e.at)} WIB</span>
              </li>
            ))}</ol>
          ) : <p className="mt-3 text-sm text-success">No events: the participant stayed on the test the whole time.</p>}
        </section>
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Longest questions</h2>
          {s.slowest.length ? <ul className="mt-3 flex flex-col divide-y divide-line">{s.slowest.map((q, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm"><span>{SEC[q.section] ?? q.section} · question {q.no}</span><span className="font-semibold text-navy">{fmt(q.timeSec)} · {q.correct == null ? "blank" : q.correct ? "correct" : "wrong"}</span></li>
          ))}</ul> : <p className="mt-3 text-sm text-ink-soft">No time recorded yet.</p>}
          {d.attempt.review?.status && <p className="mt-4 text-sm text-ink-soft">Proctoring review: <b className="text-navy">{d.attempt.review.status}</b>{d.attempt.review.note ? ` · ${d.attempt.review.note}` : ""}</p>}
        </section>
      </div>
    </div>
  );
}
