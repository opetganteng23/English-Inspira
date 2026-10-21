"use client";

import { SegmentAnalytics } from "@/components/SegmentAnalytics";

/** Analisis hasil per umur, cabang, provinsi, dan tanggal tes (semua institusi; admin pusat melihat hasil yang ditahan juga). */
export default function Analytics() {
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Analytics</h1><p className="text-sm text-ink-soft">Compare results by age group, branch, province and test date, with a map of branches.</p></div>
      <SegmentAnalytics
        api={(qs) => `/api/admin/analytics?${qs}`}
        report={(test, kind, qs) => `/api/admin/tests/${test}/${kind === "xlsx" ? "export.xlsx" : "summary.pptx"}?${qs}`}
      />
    </div>
  );
}
