"use client";

import { useState } from "react";
import { SegmentAnalytics } from "@/components/SegmentAnalytics";
import { useApi } from "@/lib/useApi";

/** Analisis hasil per umur, cabang, provinsi, dan tanggal tes. Admin pusat memilih satu institusi atau semua (hasil yang ditahan ikut terlihat). */
export default function Analytics() {
  const { data } = useApi<{ institutions: { id: string; name: string; status: string }[] }>("/api/admin/institutions");
  const [inst, setInst] = useState("");
  const q = inst ? `&institution=${inst}` : "";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Analytics</h1><p className="text-sm text-ink-soft">Compare results by age group, branch, province and test date, with a map of branches.</p></div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">Institution
          <select aria-label="Institution" className="field !w-auto" value={inst} onChange={(e) => setInst(e.target.value)}>
            <option value="">All institutions</option>
            {data?.institutions.filter((i) => i.status === "active").map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      </div>
      <SegmentAnalytics
        key={inst}
        api={(qs) => `/api/admin/analytics?${qs}${q}`}
        report={(test, kind, qs) => `/api/admin/tests/${test}/${kind === "xlsx" ? "export.xlsx" : "summary.pptx"}?${qs}${q}`}
      />
    </div>
  );
}
