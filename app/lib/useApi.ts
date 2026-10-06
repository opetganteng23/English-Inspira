"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

/** Muat data GET dengan state loading/error dan fungsi reload. */
export function useApi<T = any>(url: string | null) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!url);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try { setData(await api<T>(url)); setError(""); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
