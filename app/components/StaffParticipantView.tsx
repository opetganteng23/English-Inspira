"use client";

import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { LineChart, Loading, ErrorNote, HBars } from "@/components/Charts";

type Sec = { section: string; raw?: number; total?: number; scaled: number };
type D = {
  viewer: { role: string; full: boolean };
  profile: { id: string; name: string | null; email: string; status: string; phone: string | null; targetScore: number | null; goal: string | null; lastLoginAt: string | null; joinedAt: string | null; institution: { name: string; contractEnd: string | null } | null; personal?: { gender: string | null; birthPlace: string | null; birthDate: string | null; age: number | null; employmentStatus: string | null; jobTitle: string | null; branch: string | null; city: string | null; province: string | null; education: string | null } | null };
  level: { name: string; scoreMin: number; scoreMax: number } | null; nextLevel: { name: string; scoreMin: number } | null; levelProvisional: boolean;
  scoreEst: number | null; gapToNext: number | null;
  quota: { used: number; total: number; left: number } | null;
  counselor: { used: number; quota: number; remaining: number } | null;
  levelUp: { nextLevel: string | null; up: boolean; reasons: string[] } | null;
  hiddenHeld: number;
  coachNotes: { id: string; coach: string; shared: string | null; private: string | null; recommendLevelUp: boolean; at: string }[];
  inProgress: { test: string; startedAt: string } | null;
  plan: { id: string; title: string; priority: string; source: string; dueAt: string | null; late: boolean }[];
  weakTopics: { skill: string; topic: string; score: number; status: string }[];
  strongTopics: { skill: string; topic: string; score: number }[];
  progress: { id: string; name: string; kind: string; score: number; at: string }[];
  last: { id: string; name: string; score: number; delta: number | null; sections: Sec[]; released: boolean } | null;
  attempts: { id: string; name: string; kind: string; score: number | null; finishedAt: string | null; minutes: number | null; sections: Sec[]; released: boolean; held: boolean; flags: number }[];
};
const SEC: Record<string, string> = { listening: "Listening", structure: "Structure & WE", reading: "Reading" };
const KIND: Record<string, string> = { placement: "Placement", sim: "Simulation", final: "Final test", practice: "Practice", quiz: "Unit quiz", section: "Section test" };
const STATUS: Record<string, [string, string]> = { invited: ["Awaiting activation", "badge-warn"], active: ["Active", "badge-ok"], disabled: ["Inactive", "badge-muted"] };

/**
 * Dasbor peserta dari sisi staf: sama dengan yang dilihat peserta (level, skor, skor per bagian, kemajuan, topik lemah/kuat,
 * study plan), plus riwayat semua tes dengan tautan ke laporan lengkap. Hanya lihat.
 */
export function StaffParticipantView({ id, backHref, backLabel, reportBase }: { id: string; backHref: string; backLabel: string; reportBase: string }) {
  const reportHref = (attemptId: string) => `${reportBase}/${attemptId}`;
  const { data: h, error, loading } = useApi<D>(`/api/staff/participants/${id}/dashboard`);
  if (loading && !h) return <Loading />;
  if (!h) return <ErrorNote text={error} />;
  const p = h.profile;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={backHref} className="text-sm font-semibold text-brand">{backLabel}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="page-title">{p.name ?? p.email}</h1><span className={STATUS[p.status]?.[1] ?? "badge-muted"}>{STATUS[p.status]?.[0] ?? p.status}</span></div>
        <p className="mt-1 text-sm text-ink-soft">{p.email}{p.institution ? ` · ${p.institution.name}` : ""}{p.targetScore ? ` · target ${p.targetScore}` : ""} · last sign-in {p.lastLoginAt ? tgl(p.lastLoginAt, true) : "never"}</p>
        <p className="mt-1 text-xs text-ink-soft">Participant dashboard as the participant sees it (view only). {h.viewer.full ? "As program admin you also see results that are not released to the participant yet." : "Results that are held or not yet released are hidden."}</p>
      </div>

      {p.personal && Object.values(p.personal).some((v) => v != null) && (
        <section className="card" aria-label="Personal data">
          <h2 className="font-display text-lg font-extrabold text-navy">Personal data</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {([
              ["Branch", p.personal.branch], ["City / province", [p.personal.city, p.personal.province].filter(Boolean).join(", ") || null],
              ["Age", p.personal.age != null ? `${p.personal.age} years` : null], ["Date of birth", p.personal.birthDate ? new Date(p.personal.birthDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null],
              ["Place of birth", p.personal.birthPlace], ["Gender", p.personal.gender === "L" ? "Male" : p.personal.gender === "P" ? "Female" : null],
              ["Employment status", p.personal.employmentStatus], ["Job title", p.personal.jobTitle], ["Phone", p.phone], ["Education", p.personal.education?.toUpperCase() ?? null],
            ] as const).map(([k, v]) => <div key={k}><dt className="text-xs font-semibold tracking-wider text-ink-soft">{k.toUpperCase()}</dt><dd className="mt-0.5 font-semibold text-navy">{v ?? "-"}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-ink-soft">Confidential (NDA): visible to program admins and this participant&apos;s institution admins only.</p>
        </section>
      )}

      {h.hiddenHeld > 0 && <p role="note" className="rounded-lg bg-accent-tint p-3 text-sm text-navy">{h.hiddenHeld} test result{h.hiddenHeld === 1 ? " is" : "s are"} held by the program and will appear here once released.</p>}
      {h.inProgress && <p role="status" className="rounded-lg bg-brand-tint p-3 text-sm text-navy">Taking <b>{h.inProgress.test}</b> now (started {tgl(h.inProgress.startedAt, true)}).</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">LEVEL</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.level?.name ?? "-"}</p><p className="text-xs text-ink-soft">{h.level ? `Range ${h.level.scoreMin}-${h.level.scoreMax}` : "No placement yet"}{h.levelProvisional ? " · not released yet" : ""}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">ESTIMATED SCORE</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.scoreEst ?? "-"}</p><p className="text-xs text-ink-soft">{h.nextLevel && h.gapToNext != null ? `${h.gapToNext} points to ${h.nextLevel.name}` : "Scale 310-677"}</p></div>
        <div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">COACHING QUOTA</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.quota ? h.quota.left : "-"}<span className="text-base text-ink-soft">{h.quota ? ` / ${h.quota.total}` : ""}</span></p><p className="text-xs text-ink-soft">sessions left</p></div>
        {h.counselor && (<div className="card"><p className="text-xs font-semibold tracking-wider text-ink-soft">AI COUNSELOR</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{h.counselor.used}<span className="text-base text-ink-soft"> / {h.counselor.quota}</span></p><p className="text-xs text-ink-soft">questions used this month</p></div>)}
      </div>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-extrabold text-navy">Score progress</h2>{h.last && <Link href={reportHref(h.last.id)} className="text-sm font-semibold text-brand">Open latest full report →</Link>}</div>
        {h.progress.length ? <LineChart points={h.progress.map((x) => ({ label: x.name, value: x.score }))} target={p.targetScore} /> : <p className="mt-2 text-sm text-ink-soft">No finished tests yet.</p>}
        {h.last && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-brand-tint p-3"><p className="text-xs text-ink-soft">Last result</p><p className="font-display text-2xl font-extrabold text-navy">{h.last.score}</p>{h.last.delta != null && <p className={`text-xs font-semibold ${h.last.delta >= 0 ? "text-success" : "text-red-700"}`}>{h.last.delta >= 0 ? "+" : ""}{h.last.delta} from the previous test</p>}{!h.last.released && <p className="text-xs font-semibold text-accent-dark">not released yet</p>}</div>
            {h.last.sections.map((s) => <div key={s.section} className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">{SEC[s.section] ?? s.section}</p><p className="font-display text-2xl font-extrabold text-navy">{s.scaled}</p>{s.total ? <p className="text-xs text-ink-soft">{s.raw}/{s.total} correct</p> : null}</div>)}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Weaknesses</h2>
          <p className="text-sm text-ink-soft">Topics below the target, weakest first.</p>
          {h.weakTopics.length ? <div className="mt-3"><HBars max={100} unit="%" rows={h.weakTopics.map((w) => ({ label: `${w.topic} (${SEC[w.skill] ?? w.skill})`, value: w.score, sub: w.status === "priority" ? "priority" : "weak" }))} /></div> : <p className="mt-3 text-sm text-ink-soft">No weak topics detected yet.</p>}
        </section>
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Strengths</h2>
          <p className="text-sm text-ink-soft">Topics already at a strong level.</p>
          {h.strongTopics.length ? <div className="mt-3"><HBars max={100} unit="%" rows={h.strongTopics.map((w) => ({ label: `${w.topic} (${SEC[w.skill] ?? w.skill})`, value: w.score }))} /></div> : <p className="mt-3 text-sm text-ink-soft">No strong topics yet.</p>}
        </section>
      </div>

      {h.levelUp?.nextLevel && (
        <section className="card">
          <h2 className="font-display text-lg font-extrabold text-navy">Toward {h.levelUp.nextLevel}</h2>
          {h.levelUp.up ? <p className="mt-1 text-sm text-success">Requirements met.</p> : <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{h.levelUp.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </section>
      )}

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">All tests</h2>
        <p className="text-sm text-ink-soft">Open a row for the full report: score per section, correct and wrong answers, weaknesses, AI narrative and detailed analysis.</p>
        {h.attempts.length ? (
          <div className="table-wrap mt-3"><table>
            <thead><tr><th>Test</th><th>Date</th><th>Score</th><th>Listening</th><th>Structure</th><th>Reading</th><th>Minutes</th><th /></tr></thead>
            <tbody>{h.attempts.map((a) => {
              const s = (n: string) => { const x = a.sections.find((y) => y.section === n); return x ? `${x.scaled}${x.total ? ` (${x.raw}/${x.total})` : ""}` : "-"; };
              return (
                <tr key={a.id}>
                  <td className="font-semibold text-navy">{a.name}<span className="block text-xs font-normal text-ink-soft">{KIND[a.kind] ?? a.kind}{a.flags ? ` · ${a.flags} activity notes` : ""}{!a.released && (a.held ? " · held" : " · not released yet")}</span></td>
                  <td>{a.finishedAt ? tgl(a.finishedAt, true) : "-"}</td><td className="font-semibold text-navy">{a.score ?? "-"}</td><td>{s("listening")}</td><td>{s("structure")}</td><td>{s("reading")}</td><td>{a.minutes ?? "-"}</td>
                  <td className="whitespace-nowrap text-right"><Link href={reportHref(a.id)} className="font-semibold text-brand">Full report</Link>{h.viewer.role !== "inst_admin" && <Link href={`/admin/proctoring/${a.id}`} className="ml-3 font-semibold text-brand">Activity</Link>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="mt-3 text-sm text-ink-soft">No finished tests yet.</p>}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Coach notes</h2>
        <p className="text-sm text-ink-soft">Notes from coaching sessions, newest first.</p>
        {h.coachNotes.length ? <ul className="mt-2 flex flex-col divide-y divide-line">{h.coachNotes.map((n) => (
          <li key={n.id} className="py-3 text-sm">
            <p className="text-xs text-ink-soft">{n.coach} · {tgl(n.at, true)}{n.recommendLevelUp ? " · recommends level up" : ""}</p>
            {n.shared && <p className="mt-1 whitespace-pre-line"><b className="text-navy">For the participant:</b> {n.shared}</p>}
            {n.private && <p className="mt-1 whitespace-pre-line"><b className="text-navy">Internal note:</b> {n.private}</p>}
          </li>
        ))}</ul> : <p className="mt-2 text-sm text-ink-soft">No coach notes yet.</p>}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-extrabold text-navy">Study plan</h2>
        {h.plan.length ? <ul className="mt-2 flex flex-col divide-y divide-line">{h.plan.map((x) => <li key={x.id} className="py-2 text-sm"><b className="text-navy">{x.title}</b><br /><span className="text-xs text-ink-soft">{x.priority === "high" ? "High priority" : "Medium priority"}{x.dueAt ? ` · target ${tgl(x.dueAt)}` : ""}{x.late ? " · late" : ""}{x.source === "coach" ? " · from coach" : ""}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-soft">No active plan items.</p>}
      </section>
    </div>
  );
}
