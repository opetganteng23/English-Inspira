"use client";

import { useInstQuery } from "@/lib/inst-client";
import { Loading } from "@/components/Charts";

export default function Laporan() {
  const { url, ready } = useInstQuery();
  if (!ready) return <Loading />;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div><h1 className="page-title">Reports</h1><p className="text-sm text-ink-soft">Download group results for archiving or sharing with leadership.</p></div>
      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Participant report (Excel)</h2>
        <p className="text-sm text-ink-soft">Per participant: target, number of tests, first and last score, each section score, and last test date. Every download is recorded in the audit log.</p>
        <a className="btn-solid self-start" href={url("/api/inst/report.xlsx") ?? "#"}>Download Excel report</a>
      </section>
      <section className="card flex flex-col gap-3"><h2 className="font-display text-lg font-extrabold text-navy">Group report (PDF)</h2><p className="text-sm text-ink-soft">Aggregate summary: participants, results, level distribution, coaching attendance, most common weak topics, and participants who need attention. Does not include individual AI analyses or coach notes.</p><a className="btn-outline self-start" href={url("/api/inst/report.pdf") ?? "#"}>Download PDF report</a></section>
    </div>
  );
}
