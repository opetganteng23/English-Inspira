"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type P = { id: string; name: string | null; email: string; institution: string | null; detail?: string };
type Check = { key: string; title: string; hint: string; people: P[] };

export default function DataQuality() {
  const { data, error, reload, loading } = useApi<{ checks: Check[]; limit: number }>("/api/admin/data-quality");
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return error ? <ErrorNote text={error} /> : <Loading />;
  const issues = data.checks.reduce((n, c) => n + c.people.length, 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Data quality</h1><p className="text-sm text-ink-soft">{issues ? `${issues} item(s) to check.` : "No problems found."} QA tester accounts are not counted.</p></div>
        <button className="btn-outline" disabled={loading} onClick={reload}>{loading ? "Checking…" : "Check again"}</button>
      </div>
      {data.checks.map((c) => (
        <section key={c.key} className="card !p-0">
          <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)} disabled={!c.people.length}>
            <span><b className="text-navy">{c.title}</b><span className="block text-sm text-ink-soft">{c.hint}</span></span>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${c.people.length ? "bg-accent-tint text-accent-dark" : "bg-success-tint text-success"}`}>{c.people.length ? `${c.people.length}${c.people.length >= data.limit ? "+" : ""}` : "OK"}</span>
          </button>
          {open === c.key && (
            <div className="table-wrap border-t border-line"><table>
              <thead><tr><th>Participant</th><th>Institution</th><th>Detail</th></tr></thead>
              <tbody>{c.people.map((p, i) => <tr key={p.id + i}><td><Link href={`/admin/participants/${p.id}#admin-actions`} className="font-semibold text-navy hover:text-brand">{p.name || "(no name)"}</Link><span className="block text-xs text-ink-soft">{p.email}</span></td><td>{p.institution ?? "-"}</td><td className="text-ink-soft">{p.detail ?? ""}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      ))}
    </div>
  );
}
