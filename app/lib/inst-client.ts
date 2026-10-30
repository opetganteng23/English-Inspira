"use client";

import { createContext, createElement, useContext, useEffect, useState } from "react";

// Halaman institusi bertab milik admin memasang halaman portal di dalam tab; konteks ini memaksa institusinya.
const InstScopeContext = createContext<string | null>(null);
export function InstScope({ id, children }: { id: string; children: React.ReactNode }) {
  return createElement(InstScopeContext.Provider, { value: id }, children);
}

/** Id institusi yang dipaksa halaman admin, atau null di portal institusi. */
export function useInstScope() { return useContext(InstScopeContext); }

/** Tautan ke detail peserta: di dalam halaman admin menuju profil admin (dengan aksi), di portal menuju detail portal. */
export function useParticipantHref() {
  const forced = useContext(InstScopeContext);
  return (id: string) => (forced ? `/admin/participants/${id}` : `/institution/participants/${id}`);
}

/**
 * Admin (bukan admin institusi) membuka portal lewat ?institution=<id>. ID disimpan di sessionStorage supaya
 * pindah menu tidak kehilangan konteks. Untuk inst_admin, server mengabaikan parameter ini (selalu institusinya sendiri).
 */
export function useInstQuery() {
  const forced = useContext(InstScopeContext);
  const [q, setQ] = useState<string | null>(forced ? `institution=${forced}` : null);
  useEffect(() => {
    if (forced) { setQ(`institution=${forced}`); return; }
    let id = new URLSearchParams(window.location.search).get("institution");
    try { if (id) sessionStorage.setItem("epta_inst", id); else id = sessionStorage.getItem("epta_inst"); } catch { /* mode privat */ }
    setQ(id && /^[0-9a-f]{24}$/.test(id) ? `institution=${id}` : "");
  }, [forced]);
  const url = (path: string) => (q === null ? null : q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path);
  return { ready: q !== null, url, q: q ?? "" };
}
