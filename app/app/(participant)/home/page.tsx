"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api, tgl } from "@/lib/client";
import { LineChart, Loading, ErrorNote } from "@/components/Charts";

type Home = {
  name: string | null; institution: { name: string; contractEnd: string | null } | null;
  level: { name: string; scoreMin: number; scoreMax: number } | null; nextLevel: { name: string; scoreMin: number } | null;
  scoreEst: number | null; gapToNext: number | null;
  quota: { used: number; total: number; left: number } | null;
  counselor: { used: number; quota: number; remaining: number };
  step: { title: string; body: string; cta: string; href: string } | null;
  levelUp: { nextLevel: string | null; up: boolean; reasons: string[] } | null;
  plan: { id: string; title: string; priority: "high" | "medium"; source: string; dueAt: string | null; late: boolean; unitId: string | null }[];
  weakTopics: { skill: string; topic: string; score: number; status: string }[];
  progress: { id: string; name: string; kind: string; score: number; at: string }[];
  last: { id: string; name: string; score: number; delta: number | null; sections: { section: string; scaled: number }[] } | null;
};
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

export default function Beranda() {
  const { data: h, error, loading, reload } = useApi<Home>("/api/home");
  const [err, setErr] = useState("");
  async function done(id: string) {
    setErr("");
    try { await api(`/api/study-plan/${id}`, { method: "PATCH", json: { done: true } }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  if (loading) return <Loading />;
  if (!h) return <ErrorNote text={error} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Hello, {h.name ?? "participant"}</h1>
        <p className="mt-1 text-ink-soft">{h.institution ? `${h.institution.name}${h.institution.contractEnd ? ` · access until ${tgl(h.institution.contractEnd)}` : ""}` : "Program English Inspira"}</p>
      </div>

      {h.step && (
        <section className="rounded-2xl bg-navy p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-wider text-[#8FA6C8]">NEXT STEP</p>
          <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{h.step.title}</h2>
          <p className="mt-1 text-mist">{h.step.body}</p>
          <Link href={h.step.href} className="btn-accent mt-4">{h.step.cta}</Link>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">LEVEL</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.level?.name ?? "-"}</p><p className="text-xs text-ink-soft">{h.level ? `Range ${h.level.scoreMin}-${h.level.scoreMax}` : "Set by the placement test"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">ESTIMATED SCORE</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.scoreEst ?? "-"}</p><p className="text-xs text-ink-soft">{h.nextLevel && h.gapToNext != null ? (h.gapToNext > 0 ? `${h.gapToNext} points to ${h.nextLevel.name}` : `Already at the ${h.nextLevel.name} threshold`) : "Scale 310-677"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">COACHING QUOTA</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.quota ? `${h.quota.left}` : "-"}<span className="text-base text-ink-soft">{h.quota ? ` / ${h.quota.total}` : ""}</span></p><p className="text-xs text-ink-soft">{h.quota ? "sessions left" : "Available after placement"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">AI COUNSELOR</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.counselor.remaining}<span className="text-base text-ink-soft"> / {h.counselor.quota}</span></p><p className="text-xs text-ink-soft">questions this month</p></div>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Score progress</h2>{h.last && <Link href={`/results/${h.last.id}`} className="text-sm font-semibold text-brand">View full report</Link>}</div>
        <LineChart points={h.progress.map((p) => ({ label: p.name, value: p.score }))} />
        {h.last && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-brand-tint p-3"><p className="text-xs text-ink-soft">Last result</p><p className="font-display text-2xl font-extrabold text-navy">{h.last.score}</p>{h.last.delta != null && <p className={`text-xs font-semibold ${h.last.delta >= 0 ? "text-success" : "text-red-700"}`}>{h.last.delta >= 0 ? "+" : ""}{h.last.delta} from the previous test</p>}</div>
            {h.last.sections.map((s) => <div key={s.section} className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">{SEC[s.section] ?? s.section}</p><p className="font-display text-2xl font-extrabold text-navy">{s.scaled}</p></div>)}
          </div>
        )}
      </section>

      {h.levelUp?.nextLevel && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Toward {h.levelUp.nextLevel}</h2>
          {h.levelUp.up ? <p className="mt-1 text-sm text-success">Requirements met. Your level goes up automatically after the next simulation is scored.</p> : (
            <><p className="mt-1 text-sm text-ink-soft">Still needed to level up:</p><ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{h.levelUp.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Study plan</h2>
        <p className="text-sm text-ink-soft">Created automatically from the topics you need to strengthen, with deadlines.</p>
        <ErrorNote text={err} />
        {h.plan.length ? (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {h.plan.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 flex-1 text-sm"><b className="text-navy">{p.title}</b><br /><span className="text-xs text-ink-soft">{p.priority === "high" ? "High priority" : "Medium priority"}{p.dueAt ? ` · target ${tgl(p.dueAt)}` : ""}{p.source === "coach" ? " · from coach" : ""}{p.late && <b className="text-red-700"> · overdue</b>}</span></span>
                <span className="flex gap-2">{p.unitId && <Link href={`/learn/${p.unitId}`} className="btn-solid !min-h-[40px]">Open unit</Link>}<button className="btn-outline !min-h-[40px]" onClick={() => done(p.id)}>Mark as done</button></span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-ink-soft">{h.weakTopics.length ? "No active items yet." : "No weak topics detected yet. Your plan appears once there is enough data from your tests."}</p>}
        {h.weakTopics.length > 0 && <p className="mt-3 text-xs text-ink-soft">Topik terlemah: {h.weakTopics.map((w) => `${w.topic} (${w.score}%)`).join(", ")}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Learning materials</h2><p className="mt-1 text-sm text-ink-soft">Interactive exercises and materials to strengthen your weak areas.</p><Link href="/materials" className="btn-outline mt-4">Open materials</Link></section>
        <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">AI Counselor</h2><p className="mt-1 text-sm text-ink-soft">Ask about study strategies based on your test results.</p><Link href="/counselor" className="btn-outline mt-4">Ask the AI Counselor</Link></section>
      </div>
    </div>
  );
}
