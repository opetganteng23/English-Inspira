"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { askConfirm } from "@/components/Feedback";
import { Loading, ErrorNote } from "@/components/Charts";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { TestDayBoard } from "@/components/TestDayBoard";
import { Builder, KIND, LEARNING_KINDS, api, loadDraft, type Draft } from "@/components/TestBuilder";

// Halaman satu tes: semua urusan tes dalam tab, menggantikan deretan tombol di daftar Tests dan editor di bawah halaman.
const TABS = [["overview", "Overview"], ["setup", "Questions & settings"], ["schedule", "Schedule"], ["live", "Live (test day)"], ["results", "Results"]] as const;
type Tab = (typeof TABS)[number][0];
type Meta = { archived?: boolean; updatedAt?: string; createdAt?: string; scheduled?: boolean };
const SECTION: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };

export default function TestPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meta, setMeta] = useState<Meta>({});
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [rev, setRev] = useState(0); // editor dipasang ulang setelah disimpan agar memakai data terbaru

  const load = useCallback(async () => {
    try {
      const [d, raw] = await Promise.all([loadDraft(params.id), api(`/api/admin/tests/${params.id}`)]);
      setDraft(d); setMeta(raw); setErr(""); setRev((r) => r + 1);
    } catch (e) { setErr((e as Error).message); }
  }, [params.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some(([k]) => k === t)) setTab(t as Tab);
  }, []);
  const go = (t: Tab) => { setTab(t); window.history.replaceState(null, "", `?tab=${t}`); };

  if (err && !draft) return <ErrorNote text={err} />;
  if (!draft) return <Loading />;
  const learning = LEARNING_KINDS.includes(draft.kind);
  const status = meta.archived ? "Archived" : draft.active ? (draft.testMode ? "Live · test mode (admins and QA only)" : "Live") : "Draft";
  const questions = draft.sections.reduce((a, s) => a + s.questionIds.length, 0);
  const minutes = Math.round(draft.sections.reduce((a, s) => a + s.durationSec, 0) / 60);
  const tabs = TABS.filter(([k]) => !(learning && (k === "schedule" || k === "live" || k === "results")));

  async function archive(on: boolean) {
    if (on && !(await askConfirm(draft!.active ? "The test is turned off for participants and moved to Archived. Its results and schedule stay. You can restore it any time." : "The test moves to Archived. You can restore it any time.", { title: "Archive this test?", confirmLabel: "Archive" }))) return;
    try { await api(`/api/admin/tests/${params.id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: on }) }); load(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function remove() {
    if (!(await askConfirm("This deletes the test and its schedule. It cannot be undone.", { title: "Delete this test?", confirmLabel: "Delete", danger: true }))) return;
    try { await api(`/api/admin/tests/${params.id}`, { method: "DELETE" }); router.push(learning ? "/admin/tests?group=learning" : "/admin/tests"); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={learning ? "/admin/tests?group=learning" : "/admin/tests"} className="text-xs font-semibold tracking-wider text-brand">{learning ? "COURSE QUIZZES" : "TESTS"} · {(KIND[draft.kind] ?? draft.kind).toUpperCase()}</Link>
          <h1 className="page-title">{draft.name}</h1>
          <p className="text-sm text-ink-soft"><StatusDot status={status} /> {status} · {questions} questions · {minutes} min · taken {draft.attempts.toLocaleString("en")}×</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-solid" href={`/admin/tests/${params.id}/preview`}>Preview as participant</Link>
          {meta.archived ? <button className="btn-outline" onClick={() => archive(false)}>Restore</button> : <button className="btn-outline" onClick={() => archive(true)}>Archive</button>}
          {draft.attempts === 0 && <button className="btn-outline !text-red-700" onClick={remove}>Delete</button>}
        </div>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div role="tablist" aria-label="Test sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === k ? "border-brand text-navy" : "border-transparent text-ink-soft hover:text-navy"}`}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card lg:col-span-2">
            <h2 className="mb-3 font-display text-lg font-extrabold text-navy">Sections</h2>
            <ul className="flex flex-col divide-y divide-line">
              {draft.sections.map((s) => <li key={s.name} className="flex justify-between py-2 text-sm"><span className="font-semibold text-navy">{SECTION[s.name] ?? s.name}</span><span className="text-ink-soft">{s.questionIds.length} questions · {Math.round(s.durationSec / 60)} min</span></li>)}
            </ul>
            <h2 className="mb-2 mt-5 font-display text-lg font-extrabold text-navy">Rules</h2>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[[draft.secureMode, "Secure mode"], [draft.screenWatch, "Live screen view"], [draft.shuffleQuestions, "Shuffled questions"], [draft.shuffleWithinParts, "Shuffled within parts"], [draft.shuffleOptions, "Shuffled options"], [(draft.resultDelayMin ?? 0) > 0, `Results after ${draft.resultDelayMin} min`], [(draft.maxAttempts ?? 0) > 0, `Max ${draft.maxAttempts} attempts`]]
                .filter(([on]) => on).map(([, l]) => <span key={String(l)} className="badge-muted">{l}</span>)}
              {!draft.secureMode && !draft.screenWatch && !draft.shuffleQuestions && !draft.shuffleWithinParts && !draft.shuffleOptions && !draft.resultDelayMin && !draft.maxAttempts && <span className="text-ink-soft">Default rules.</span>}
            </div>
            <button className="btn-outline mt-5" onClick={() => go("setup")}>Edit questions & settings</button>
          </section>
          <section className="card flex flex-col gap-3 text-sm">
            <h2 className="font-display text-lg font-extrabold text-navy">Next step</h2>
            {meta.archived ? <p className="text-ink-soft">Archived. Restore it to use it again.</p>
              : !draft.active ? <p className="text-ink-soft">Draft: participants cannot see it. Finish the questions, then turn on <b>Active</b> in Questions & settings.</p>
              : draft.testMode ? <p className="text-ink-soft">Only admins and QA testers can see it. Try it, then turn off <b>Test mode</b> in Questions & settings.</p>
              : learning ? <p className="text-ink-soft">Live. Learners take it from its course in <Link href="/admin/courses" className="font-semibold text-brand">Courses & Units</Link>.</p>
              : <p className="text-ink-soft">Live. {meta.scheduled ? "Only participants with a seat can take it, during their session." : "Set up sessions in Schedule if only some participants should take it."}</p>}
            {!learning && <button className="btn-outline" onClick={() => go("schedule")}>Open schedule</button>}
            {!learning && draft.attempts > 0 && <button className="btn-outline" onClick={() => go("results")}>See results</button>}
            {draft.attempts > 0 && <p className="text-xs text-ink-soft">Taken by participants, so the question set and durations are locked. Make a new test to change them.</p>}
          </section>
        </div>
      )}
      {tab === "setup" && <Builder key={rev} inline draft={draft} kinds={learning ? LEARNING_KINDS : Object.keys(KIND).filter((k) => !LEARNING_KINDS.includes(k))} onSaved={() => load()} />}
      {tab === "schedule" && <ScheduleBoard testId={params.id} embedded />}
      {tab === "live" && <TestDayBoard testId={params.id} />}
      {tab === "results" && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold text-navy">Results</h2>
          <p className="text-sm text-ink-soft">{draft.attempts.toLocaleString("en")} attempts. Downloads cover every session of this test.</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-solid" href={`/api/admin/tests/${params.id}/export.xlsx`}>Download results (Excel)</a>
            <a className="btn-outline" href={`/api/admin/tests/${params.id}/summary.pptx`}>Executive summary (PowerPoint)</a>
            <Link className="btn-outline" href="/admin/analytics">Open Analytics</Link>
            <Link className="btn-outline" href="/admin/proctoring">Monitoring & proctoring</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = status.startsWith("Live") ? (status.includes("test mode") ? "bg-accent" : "bg-success") : status === "Draft" ? "bg-ink-soft" : "bg-line-strong";
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full align-middle ${c}`} />;
}
