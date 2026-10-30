"use client";

import { useApi } from "./useApi";
import type { Features } from "./features";

/** Saklar fitur bagi pengguna yang login (global + modul institusinya). Selama dimuat dianggap mati, agar tautan ke halaman yang hilang tidak sempat muncul. */
export function useFeatures(): Partial<Features> {
  return useApi<Features>("/api/features").data ?? {};
}
