"use client";

import { SegmentAnalytics } from "@/components/SegmentAnalytics";
import { useInstQuery } from "@/lib/inst-client";
import { Loading } from "@/components/Charts";

/** Analisis hasil peserta institusi ini per umur, cabang, provinsi, dan tanggal tes. */
export default function InstAnalytics() {
  const { url, ready } = useInstQuery();
  if (!ready) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Analytics</h1><p className="text-sm text-ink-soft">Results of your participants by age group, branch, province and test date. Only released results are counted.</p></div>
      <SegmentAnalytics
        api={(qs) => url(`/api/inst/analytics?${qs}`)}
        exports={(test, dim) => [
          { label: "Excel", href: url(`/api/inst/tests/${test}/export.xlsx`) ?? "#" },
          { label: "Executive summary (PPT)", href: url(`/api/inst/tests/${test}/summary.pptx?groups=${dim}`) ?? "#" },
        ]}
      />
    </div>
  );
}
