"use client";

import { MonitoringBoard, type BoardApi } from "@/components/MonitoringBoard";

const apis: BoardApi = {
  list: (qs) => `/api/admin/monitor${qs ? `?${qs}` : ""}`,
  trace: (id) => `/api/admin/monitor/${id}`,
  canReview: true,
  timeline: (id) => `/admin/proctoring/${id}`,
};

export default function Monitoring() {
  return <MonitoringBoard apis={apis} />;
}
