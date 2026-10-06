"use client";

import { useEffect, useState } from "react";

/**
 * Admin (bukan admin institusi) membuka portal lewat ?institution=<id>. ID disimpan di sessionStorage supaya
 * pindah menu tidak kehilangan konteks. Untuk inst_admin, server mengabaikan parameter ini (selalu institusinya sendiri).
 */
export function useInstQuery() {
  const [q, setQ] = useState<string | null>(null);
  useEffect(() => {
    let id = new URLSearchParams(window.location.search).get("institution");
    try { if (id) sessionStorage.setItem("epta_inst", id); else id = sessionStorage.getItem("epta_inst"); } catch { /* mode privat */ }
    setQ(id && /^[0-9a-f]{24}$/.test(id) ? `institution=${id}` : "");
  }, []);
  const url = (path: string) => (q === null ? null : q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path);
  return { ready: q !== null, url, q: q ?? "" };
}
