"use client";

import { useMemo } from "react";
import { MonitoringBoard, type BoardApi } from "@/components/MonitoringBoard";
import { useInstQuery } from "@/lib/inst-client";
import { Loading } from "@/components/Charts";

/** Monitoring & Proctoring untuk portal institusi: hanya peserta institusi ini, tanpa tinjauan (dilakukan admin program). */
export default function InstMonitoring() {
  const { url, ready, q } = useInstQuery();
  const apis: BoardApi = useMemo(() => ({ list: (qs) => url(`/api/inst/monitor${qs ? `?${qs}` : ""}`), trace: (id) => url(`/api/inst/monitor/${id}`), canReview: false }), [q, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return <Loading />;
  return <MonitoringBoard apis={apis} />;
}
