"use client";

import { useEffect } from "react";

type A = { overlay: number; auth: string | null; page: string | null };
const KEY = "ei-appearance";

/** Pasang gambar latar panel merek sebagai variabel CSS di <html>. Nilai terakhir diingat di browser supaya tampil tanpa kedip. */
function apply(a: A) {
  const h = document.documentElement;
  const set = (slot: "auth" | "page", url: string | null) => {
    if (url) { h.style.setProperty(`--bg-${slot}`, `url("${url}")`); h.dataset[`bg${slot === "auth" ? "Auth" : "Page"}`] = "1"; }
    else { h.style.removeProperty(`--bg-${slot}`); delete h.dataset[`bg${slot === "auth" ? "Auth" : "Page"}`]; }
  };
  set("auth", a.auth); set("page", a.page);
  h.style.setProperty("--bg-overlay", String(a.overlay / 100));
}

export function BrandBg() {
  useEffect(() => {
    try { const c = localStorage.getItem(KEY); if (c) apply(JSON.parse(c)); } catch { /* */ }
    const on = (e: Event) => apply((e as CustomEvent<A>).detail);
    window.addEventListener("brand-bg", on);
    fetch("/api/brand/appearance").then((r) => r.json()).then((a: A) => { apply(a); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* */ } }).catch(() => {});
    return () => window.removeEventListener("brand-bg", on);
  }, []);
  return null;
}
