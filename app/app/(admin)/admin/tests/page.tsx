"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Builder, KIND, LEARNING_KINDS, NEW_DRAFT, api, type Draft, type T } from "@/components/TestBuilder";

type Status = "live" | "draft" | "archived";
// Live = aktif (termasuk test mode, yang hanya terlihat oleh admin/QA); Draft = belum aktif; Archived = disingkirkan.
const statusOf = (t: T): Status => (t.archived ? "archived" : t.active ? "live" : "draft");
const STATUS_LABEL: Record<Status, string> = { live: "Live", draft: "Draft", archived: "Archived" };
const ago = (d?: string) => {
  if (!d) return "–";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days < 1 ? "Today" : days === 1 ? "Yesterday" : days < 30 ? `${days} days ago` : new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function TestsAdmin() {
  const router = useRouter();
  const sp = useSearchParams();
  const group = sp.get("group") === "learning" ? "learning" : "tests";
  const [tests, setTests] = useState<T[] | null>(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<Status>("live");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"edited" | "name" | "attempts">("edited");
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => api("/api/admin/tests").then((d) => { setTests(d.tests); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (sp.get("new")) setDraft(NEW_DRAFT(sp.get("new") === "section" ? "section" : sp.get("new") === "quiz" ? "quiz" : "placement")); }, [sp]);

  const inGroup = useMemo(() => (tests ?? []).filter((t) => LEARNING_KINDS.includes(t.kind) === (group === "learning")), [tests, group]);
  const counts = useMemo(() => ({ live: 0, draft: 0, archived: 0, ...inGroup.reduce<Record<string, number>>((a, t) => ({ ...a, [statusOf(t)]: (a[statusOf(t)] ?? 0) + 1 }), {}) }), [inGroup]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inGroup
      .filter((t) => statusOf(t) === status && (!needle || t.name.toLowerCase().includes(needle) || (KIND[t.kind] ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "attempts" ? b.attempts - a.attempts : String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  }, [inGroup, status, q, sort]);

  const tab = (g: string, label: string) => (
    <Link href={g === "tests" ? "/admin/tests" : "/admin/tests?group=learning"} replace aria-current={group === g ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${group === g ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-navy"}`}>{label}</Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Tests</h1>
          <p className="text-sm text-ink-soft">{group === "tests" ? "Scheduled and scored tests: placement, simulation, final, practice. Click a test to manage its questions, settings, schedule, and results." : "Unit quizzes and section tests belong to courses. Attach them in Courses & Units."}</p>
        </div>
        <button className="btn-solid" onClick={() => setDraft(NEW_DRAFT(group === "learning" ? "quiz" : "placement"))}>+ New {group === "learning" ? "quiz" : "test"}</button>
      </div>

      <div className="flex gap-1 border-b border-line">{tab("tests", "Tests")}{tab("learning", "Course quizzes")}</div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="field !h-10 w-full sm:w-64" placeholder="Search by name or type" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tests" />
        <div role="tablist" aria-label="Status" className="flex gap-1">
          {(["live", "draft", "archived"] as Status[]).map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status === s ? "bg-navy text-white" : "bg-canvas text-ink hover:bg-brand-tint"}`}>
              {STATUS_LABEL[s]} <span className={status === s ? "text-white/70" : "text-ink-soft"}>{counts[s]}</span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">Sort
          <select className="field !h-10 w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="edited">Last edited</option><option value="name">Name</option><option value="attempts">Most taken</option>
          </select>
        </label>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase text-ink-soft"><tr><th className="p-3">Name</th><th>Type</th><th>Questions</th><th>Duration</th><th>Taken</th><th>Edited</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="cursor-pointer border-t border-line hover:bg-brand-tint/40" onClick={() => router.push(`/admin/tests/${t.id}`)}>
                <td className="p-3">
                  <Link href={`/admin/tests/${t.id}`} className="font-semibold text-navy hover:text-brand" onClick={(e) => e.stopPropagation()}>{t.name}</Link>
                  {t.testMode && !t.archived && <span className="badge-warn ml-2">test mode</span>}
                </td>
                <td>{KIND[t.kind] ?? t.kind}</td><td>{t.questions}</td><td>{Math.round(t.durationSec / 60)} min</td><td>{t.attempts.toLocaleString("en")}</td><td className="whitespace-nowrap pr-3 text-ink-soft">{ago(t.updatedAt)}</td>
              </tr>
            ))}
            {tests && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-ink-soft">
                {q ? "No tests match your search." : status === "live" ? "No live tests. Open Draft to finish one, or click “+ New test”." : status === "draft" ? "No drafts." : "Nothing archived. Archive old drafts from their test page to keep this list short."}
              </td></tr>
            )}
            {!tests && !err && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      {draft && <Builder draft={draft} kinds={group === "learning" ? LEARNING_KINDS : Object.keys(KIND).filter((k) => !LEARNING_KINDS.includes(k))}
        onClose={() => { setDraft(null); if (sp.get("new")) router.replace(group === "learning" ? "/admin/tests?group=learning" : "/admin/tests"); }}
        onSaved={(id) => router.push(`/admin/tests/${id}`)} />}
    </div>
  );
}
