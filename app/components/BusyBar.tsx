"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Garis loading tipis di atas layar + kursor "progress", supaya klik yang menunggu server tidak terlihat hang.
// Muncul saat pindah halaman (klik link) dan saat fetch yang dipicu klik/ketik pengguna masih berjalan.
// Fetch latar (polling, heartbeat, autosave tanpa interaksi) diabaikan. Ruang tes punya notifikasinya sendiri.

const SHOW_AFTER = 150; // ms; respons cepat tidak memunculkan apa-apa
const USER_WINDOW = 1500; // fetch yang dimulai sekian ms setelah interaksi dianggap aksi pengguna

export function BusyBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [on, setOn] = useState(false);
  const nav = useRef(false);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skip = pathname?.startsWith("/test-room");

  const sync = useRef(() => {});
  sync.current = () => {
    const busy = nav.current || pending.current > 0;
    if (busy && !timer.current && !on) timer.current = setTimeout(() => { timer.current = null; setOn(true); }, SHOW_AFTER);
    if (!busy) { if (timer.current) clearTimeout(timer.current); timer.current = null; setOn(false); }
  };

  // Navigasi selesai saat URL berubah.
  useEffect(() => { nav.current = false; sync.current(); }, [pathname, search]);

  useEffect(() => {
    let lastInput = 0;
    const mark = () => { lastInput = Date.now(); };
    const onClick = (e: MouseEvent) => {
      mark();
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // hanya #anchor / halaman sama
      nav.current = true; sync.current();
      setTimeout(() => { nav.current = false; sync.current(); }, 15_000); // navigasi batal/gagal: jangan macet
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", mark, true);
    document.addEventListener("submit", mark, true);
    window.addEventListener("popstate", () => { nav.current = true; sync.current(); });

    const orig = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      const counted = Date.now() - lastInput < USER_WINDOW && !location.pathname.startsWith("/test-room");
      if (counted) { pending.current++; sync.current(); }
      const p = orig(...args);
      if (counted) p.finally(() => { pending.current--; sync.current(); }).catch(() => {});
      return p;
    };
    return () => {
      window.fetch = orig;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", mark, true);
      document.removeEventListener("submit", mark, true);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-busy", on && !skip);
  }, [on, skip]);

  if (!on || skip) return null;
  return (
    <div role="progressbar" aria-label="Loading" className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-brand/15">
      <div className="busy-bar h-full w-1/3 bg-brand" />
    </div>
  );
}
