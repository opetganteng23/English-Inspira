"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";
import type { MapPoint } from "@/components/SegmentMap";
import { Modal } from "@/components/Modal";

const SegmentMap = dynamic(() => import("@/components/SegmentMap").then((m) => m.SegmentMap), { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-canvas" /> });

type Seg = {
  key: string; label: string; scheduled: number; finished: number; absent: number; avg: number | null; median: number | null; min: number | null; max: number | null;
  atTarget: number; pctTarget: number | null; levels: Record<string, number>; sections: { listening: number | null; structure: number | null; reading: number | null };
  weakTopic: { name: string; section: string; pct: number } | null; avgAge: number | null; lat: number | null; lng: number | null;
};
type Resp = { tests: { id: string; name: string; finished: number }[]; dims: { key: string; label: string }[]; dim: string; data: { test: { id: string; name: string }; levels: string[]; target: number; held: number; branches: string[]; provinces: string[]; ageGroups: { key: string; label: string }[]; segments: Seg[]; overall: Seg | null } | null };
type SortKey = "label" | "scheduled" | "finished" | "avg" | "pctTarget" | "listening" | "structure" | "reading";
const LV_COL = ["bg-sky-500", "bg-brand", "bg-navy"];
const r1 = (n: number | null | undefined) => (n == null ? "-" : (Math.round(n * 10) / 10).toLocaleString("en-US"));
const r0 = (n: number | null | undefined) => (n == null ? "-" : Math.round(n).toLocaleString("en-US"));

/**
 * Analisis per kelompok (umur, cabang, provinsi, tanggal tes) untuk admin pusat dan portal institusi.
 * `api` membangun URL endpoint dengan query; `exports` memberi tautan unduhan untuk tes terpilih.
 */
export type ReportKind = "xlsx" | "pptx";
export function SegmentAnalytics({ api, report }: { api: (qs: string) => string | null; report?: (testId: string, kind: ReportKind, qs: string) => string | null }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dl, setDl] = useState(false);
  const [test, setTest] = useState("");
  const [dim, setDim] = useState("branch");
  const [target, setTarget] = useState(550);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "avg", dir: -1 });
  const [focus, setFocus] = useState<string | null>(null);
  const qs = new URLSearchParams({ dim, target: String(target) }); if (test) qs.set("test", test); if (from) qs.set("from", from); if (to) qs.set("to", to);
  const { data, error, loading } = useApi<Resp>(api(qs.toString()));
  const d = data?.data;
  const rows = useMemo(() => {
    const list = [...(d?.segments ?? [])];
    const v = (s: Seg): number | string => (sort.key === "label" ? s.label.toLowerCase() : sort.key === "listening" || sort.key === "structure" || sort.key === "reading" ? s.sections[sort.key] ?? -1 : (s[sort.key] as number | null) ?? -1);
    if (dim === "age" || dim === "date") return list; // urutan alami (umur naik, tanggal naik)
    return list.sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [d, sort, dim]);
  const points: MapPoint[] = useMemo(() => (d?.segments ?? []).filter((s) => s.lat != null && s.lng != null).map((s) => ({ key: s.key, label: s.label, lat: s.lat!, lng: s.lng!, finished: s.finished, avg: s.avg, pctTarget: s.pctTarget })), [d]);
  const pick = useCallback((k: string) => setFocus(k), []);
  const maxAvg = Math.max(677, ...rows.map((s) => s.avg ?? 0)), minAxis = 310;
  const o = d?.overall;
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cls}><button className={`inline-flex items-center gap-1 font-semibold uppercase ${sort.key === key ? "text-brand" : ""}`} disabled={dim === "age" || dim === "date"} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "label" ? 1 : -1 }))}>{label}{dim !== "age" && dim !== "date" && <span aria-hidden className="text-[10px]">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>}</button></th>
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3 !p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Test" className="field !w-auto" value={test || d?.test.id || ""} onChange={(e) => { setTest(e.target.value); setFocus(null); }}>
            {data?.tests.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.finished.toLocaleString("en-US")} finished</option>)}
          </select>
          <div className="flex flex-wrap gap-1 rounded-lg bg-canvas p-1 text-sm" role="tablist" aria-label="Group by">
            {(data?.dims ?? []).filter((x) => x.key !== "overall").map((x) => <button key={x.key} role="tab" aria-selected={dim === x.key} onClick={() => { setDim(x.key); setFocus(null); setSort({ key: "avg", dir: -1 }); }} className={`rounded-md px-3 py-1.5 font-semibold ${dim === x.key ? "bg-navy text-white" : "text-ink-soft"}`}>{x.label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">Target<input type="number" min={310} max={677} className="field !w-24" value={target} onChange={(e) => setTarget(Math.max(310, Math.min(677, Number(e.target.value) || 550)))} /></label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">Test date<input type="date" aria-label="From date" className="field !w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />to<input type="date" aria-label="To date" className="field !w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          {(from || to) && <button className="text-sm font-semibold text-brand" onClick={() => { setFrom(""); setTo(""); }}>All dates</button>}
          {report && d && <button className="btn-solid ml-auto !min-h-[40px]" onClick={() => setDl(true)}>Download report</button>}
        </div>
        {d && d.held > 0 && <p className="rounded-lg bg-accent-tint p-2 text-sm text-navy">{d.held} result{d.held === 1 ? " is" : "s are"} held by the program and not counted yet.</p>}
      </div>
      <ErrorNote text={error} />
      {dl && d && report && <DownloadDialog testId={d.test.id} testName={d.test.name} branches={d.branches ?? []} provinces={d.provinces ?? []} ageGroups={d.ageGroups ?? []} from={from} to={to} target={target} report={report} onClose={() => setDl(false)} />}
      {loading && !data ? <Loading /> : !d ? <div className="card py-10 text-center text-ink-soft">No finished tests yet.</div> : (
        <>
          {o && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {([["SCHEDULED", r0(o.scheduled)], ["FINISHED", r0(o.finished)], ["AVERAGE SCORE", r0(o.avg)], [`≥ ${d.target}`, o.pctTarget != null ? `${r1(o.pctTarget)}%` : "-"], ["AVERAGE AGE", o.avgAge != null ? `${r1(o.avgAge)} yrs` : "-"]] as const).map(([k, v]) => (
              <div key={k} className="card !p-4"><p className="text-xs font-semibold tracking-wider text-ink-soft">{k}</p><p className="mt-1 font-display text-2xl font-extrabold text-navy">{v}</p></div>
            ))}
          </div>}

          <div className={`grid gap-5 ${points.length ? "xl:grid-cols-2" : ""}`}>
            {points.length > 0 && <section className="card"><h2 className="mb-3 font-display text-lg font-extrabold text-navy">Map by branch</h2><SegmentMap points={points} target={d.target} onPick={pick} />{focus && <p className="mt-2 text-sm text-navy">Selected: <b>{focus}</b> <button className="ml-2 text-brand" onClick={() => setFocus(null)}>clear</button></p>}</section>}
            <section className="card">
              <h2 className="mb-3 font-display text-lg font-extrabold text-navy">Average score</h2>
              <ul className="flex max-h-[460px] flex-col gap-1.5 overflow-y-auto pr-1">
                {rows.filter((s) => s.finished).map((s) => {
                  const w = s.avg == null ? 0 : ((s.avg - minAxis) / (maxAvg - minAxis)) * 100, tl = ((d.target - minAxis) / (maxAvg - minAxis)) * 100;
                  return (
                    <li key={s.key || "none"} className={`grid grid-cols-[150px_1fr_60px] items-center gap-2 rounded-md px-1 text-sm ${focus === s.key ? "bg-brand-tint" : ""}`}>
                      <button className="truncate text-left font-semibold text-navy" title={s.label} onClick={() => setFocus(s.key)}>{s.label}</button>
                      <div className="relative h-4 rounded bg-canvas"><div className={`h-4 rounded ${s.avg != null && s.avg >= d.target ? "bg-success" : s.avg != null && s.avg >= d.target - 50 ? "bg-accent" : "bg-red-600"}`} style={{ width: `${Math.max(1, w)}%` }} /><div className="absolute inset-y-[-3px] w-0.5 bg-navy" style={{ left: `${tl}%` }} title={`Target ${d.target}`} /></div>
                      <span className="text-right font-semibold tabular-nums text-navy">{r0(s.avg)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-ink-soft">Dark line = target {d.target}. Bars: green ≥ target, orange within 50 points, red below.</p>
            </section>
          </div>

          <section className="table-wrap card !p-0">
            <table className="w-full text-sm">
              <thead><tr>{th("label", (data?.dims.find((x) => x.key === dim)?.label ?? "Group"))}{th("scheduled", "Scheduled", "text-right")}{th("finished", "Finished", "text-right")}{th("avg", "Avg", "text-right")}<th className="text-right">Median</th><th className="text-right">Range</th>{th("pctTarget", `≥ ${d.target}`, "text-right")}<th>Levels</th>{th("listening", "L", "text-right")}{th("structure", "S", "text-right")}{th("reading", "R", "text-right")}<th>Weakest topic</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.key || "none"} className={focus === s.key ? "bg-brand-tint" : ""} onClick={() => setFocus(s.key)}>
                    <td className="font-semibold text-navy">{s.label}{s.avgAge != null && dim !== "age" && <span className="block text-xs font-normal text-ink-soft">avg age {r1(s.avgAge)}</span>}</td>
                    <td className="text-right">{s.scheduled}</td><td className="text-right">{s.finished}{s.absent ? <span className="block text-xs text-red-700">{s.absent} absent</span> : null}</td>
                    <td className="text-right font-semibold text-navy">{r0(s.avg)}</td><td className="text-right">{r0(s.median)}</td><td className="whitespace-nowrap text-right text-xs">{s.min != null ? `${s.min}–${s.max}` : "-"}</td>
                    <td className="text-right">{s.pctTarget != null ? `${r1(s.pctTarget)}%` : "-"}</td>
                    <td className="min-w-[120px]">{s.finished ? <><div className="flex h-2.5 overflow-hidden rounded-full bg-canvas">{d.levels.map((l, i) => <div key={l} className={LV_COL[i] ?? "bg-ink-soft"} style={{ width: `${(100 * (s.levels[l] ?? 0)) / s.finished}%` }} title={`${l}: ${s.levels[l] ?? 0}`} />)}</div><p className="mt-0.5 text-[11px] text-ink-soft">{d.levels.map((l) => `${l[0]} ${s.levels[l] ?? 0}`).join(" · ")}</p></> : "-"}</td>
                    <td className="text-right">{r1(s.sections.listening)}</td><td className="text-right">{r1(s.sections.structure)}</td><td className="text-right">{r1(s.sections.reading)}</td>
                    <td className="text-xs">{s.weakTopic ? <><span className="font-semibold capitalize text-navy">{s.weakTopic.name}</span> <span className="text-ink-soft">{s.weakTopic.section} · {r0(s.weakTopic.pct)}%</span></> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-xs text-ink-soft">Ages are shown as groups only. Branch and age come from the institution&apos;s personnel data (confidential).</p>
        </>
      )}
    </div>
  );
}

/** Pilih format, cakupan (semua / satu kelompok umur / satu cabang), dan rentang tanggal tes sebelum mengunduh laporan. */
function DownloadDialog({ testId, testName, branches, provinces, ageGroups, from: f0, to: t0, target, report, onClose }: { testId: string; testName: string; branches: string[]; provinces: string[]; ageGroups: { key: string; label: string }[]; from: string; to: string; target: number; report: (testId: string, kind: ReportKind, qs: string) => string | null; onClose: () => void }) {
  const [kind, setKind] = useState<ReportKind>("pptx");
  const [what, setWhat] = useState<"results" | "schedule">("results");
  const [scope, setScope] = useState<"all" | "age" | "branch" | "province">("all");
  const [province, setProvince] = useState(provinces[0] ?? "");
  const [age, setAge] = useState(ageGroups[0]?.key ?? "");
  const [branch, setBranch] = useState(branches[0] ?? "");
  const [from, setFrom] = useState(f0);
  const [to, setTo] = useState(t0);
  const qs = new URLSearchParams({ target: String(target) });
  if (what === "schedule") qs.set("report", "schedule");
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (scope === "age" && age) qs.set("age", age);
  if (scope === "branch" && branch) qs.set("branch", branch);
  if (scope === "province" && province) qs.set("province", province);
  const href = report(testId, kind, qs.toString());
  const who = scope === "age" ? `age ${ageGroups.find((g) => g.key === age)?.label ?? ""}` : scope === "branch" ? branch : scope === "province" ? province : "all participants";
  const when = from || to ? `${from || "start"} to ${to || "today"}` : what === "schedule" ? "all dates" : "all test dates";
  const radio = "flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint";
  return (
    <Modal title="Download report" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">{testName}</p>
        <fieldset className="flex flex-col gap-2"><legend className="mb-1 font-semibold text-navy">Report</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className={radio}><input type="radio" name="what" checked={what === "results"} onChange={() => setWhat("results")} />Test results &amp; attendance</label>
            <label className={radio}><input type="radio" name="what" checked={what === "schedule"} onChange={() => setWhat("schedule")} />Schedule changes</label>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2"><legend className="mb-1 font-semibold text-navy">Format</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className={radio}><input type="radio" name="kind" checked={kind === "pptx"} onChange={() => setKind("pptx")} />Executive summary (PPT)</label>
            <label className={radio}><input type="radio" name="kind" checked={kind === "xlsx"} onChange={() => setKind("xlsx")} />Excel</label>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2"><legend className="mb-1 font-semibold text-navy">Participants</legend>
          <label className={radio}><input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} />All participants (includes comparison by age and branch)</label>
          <label className={radio}><input type="radio" name="scope" checked={scope === "age"} onChange={() => setScope("age")} />One age group
            <select aria-label="Age group" className="field ml-auto !w-auto" value={age} onChange={(e) => { setAge(e.target.value); setScope("age"); }}>{ageGroups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
          {provinces.length > 0 && <label className={radio}><input type="radio" name="scope" checked={scope === "province"} onChange={() => setScope("province")} />One province
            <select aria-label="Province" className="field ml-auto !w-auto max-w-[220px]" value={province} onChange={(e) => { setProvince(e.target.value); setScope("province"); }}>{provinces.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>}
          {branches.length > 0 && <label className={radio}><input type="radio" name="scope" checked={scope === "branch"} onChange={() => setScope("branch")} />One branch
            <select aria-label="Branch" className="field ml-auto !w-auto max-w-[220px]" value={branch} onChange={(e) => { setBranch(e.target.value); setScope("branch"); }}>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>}
        </fieldset>
        <fieldset><legend className="mb-1 font-semibold text-navy">{what === "schedule" ? "Date the schedule was changed" : "Test date"}</legend>
          <div className="flex flex-wrap items-center gap-2"><input type="date" aria-label="From date" className="field !w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /><span className="text-ink-soft">to</span><input type="date" aria-label="To date" className="field !w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />{(from || to) && <button className="text-sm font-semibold text-brand" onClick={() => { setFrom(""); setTo(""); }}>All dates</button>}</div>
          <p className="mt-1 text-xs text-ink-soft">Leave empty for all dates. Pick the same date twice for a single day.</p>
        </fieldset>
        <p className="rounded-lg bg-canvas p-3 text-navy">You will download: <b>{what === "schedule" ? "Schedule changes" : "Test results"} ({kind === "pptx" ? "executive summary" : "Excel"})</b> for <b>{who}</b>, <b>{when}</b>.</p>
        <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>Cancel</button>{href && <a className="btn-solid" href={href} onClick={() => setTimeout(onClose, 300)}>Download</a>}</div>
      </div>
    </Modal>
  );
}
