"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/Feedback";

/**
 * Mode aman untuk tes dan course yang ditandai admin:
 * - tidak bisa menyalin, memotong, menempel, memilih teks, klik kanan, atau seret;
 * - pintasan Ctrl/Cmd + C, X, V, A, S, P, U diblokir;
 * - tombol Kembali browser ditahan (halaman tidak mundur).
 * Ini menyulitkan, bukan perlindungan mutlak (tangkapan layar atau kamera tetap mungkin).
 */
export function SecureZone({ active, children, allowBackHint = "Going back is turned off for this test." }: { active: boolean; children: React.ReactNode; allowBackHint?: string }) {
  const last = useRef(0);
  useEffect(() => {
    if (!active) return;
    const warn = (msg: string) => { if (Date.now() - last.current > 2500) { last.current = Date.now(); toast(msg, "error"); } };
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, [contenteditable=true]");
    const block = (e: Event) => { if (e.type === "paste" || !isField(e.target)) { e.preventDefault(); warn("Copying and pasting are turned off here."); } };
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "v", "a", "s", "p", "u"].includes(e.key.toLowerCase()) && !(isField(e.target) && ["a"].includes(e.key.toLowerCase()))) { e.preventDefault(); warn("This shortcut is turned off here."); }
    };
    // Kembali browser: dorong kembali state yang sama setiap kali pengguna menekan Kembali.
    history.pushState({ secure: true }, "", location.href);
    const pop = () => { history.pushState({ secure: true }, "", location.href); warn(allowBackHint); };
    const evs = ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"] as const;
    evs.forEach((t) => document.addEventListener(t, block));
    document.addEventListener("keydown", keys);
    window.addEventListener("popstate", pop);
    document.documentElement.classList.add("secure-zone");
    return () => {
      evs.forEach((t) => document.removeEventListener(t, block));
      document.removeEventListener("keydown", keys);
      window.removeEventListener("popstate", pop);
      document.documentElement.classList.remove("secure-zone");
    };
  }, [active, allowBackHint]);
  return <>{children}</>;
}
