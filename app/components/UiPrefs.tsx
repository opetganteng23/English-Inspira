"use client";

import { useEffect } from "react";

// Terapkan uiPrefs ke <html> (tema, ukuran teks baca, kurangi gerak). Disimpan juga di localStorage
// agar skrip awal di layout bisa menerapkannya sebelum halaman tampil (tanpa kedip).
export type Prefs = { theme: "system" | "light" | "dark"; fontSize: number; reduceMotion: boolean } & Record<string, unknown>;
export const PREFS_KEY = "ei.prefs";

export function applyPrefs(p: Partial<Prefs>) {
  const r = document.documentElement;
  if (!p.theme || p.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", p.theme);
  r.style.setProperty("--fs-read", `${p.fontSize ?? 18}px`);
  if (p.reduceMotion) r.setAttribute("data-motion", "reduce"); else r.removeAttribute("data-motion");
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* tanpa storage */ }
}

/** Ambil preferensi dari server saat aplikasi dibuka, lalu terapkan. */
export function UiPrefsSync() {
  useEffect(() => {
    fetch("/api/me/ui-prefs").then((r) => (r.ok ? r.json() : null)).then((p) => { if (p) applyPrefs(p); }).catch(() => {});
  }, []);
  return null;
}

/** Skrip sebelum hidrasi: terapkan preferensi terakhir dari localStorage. */
export const PREFS_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}");var r=document.documentElement;if(p.theme&&p.theme!=="system")r.setAttribute("data-theme",p.theme);if(p.fontSize)r.style.setProperty("--fs-read",p.fontSize+"px");if(p.reduceMotion)r.setAttribute("data-motion","reduce");}catch(e){}})();`;
