"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tgl } from "@/lib/client";

type N = { id: string; title: string; body: string; href: string; read: boolean; at: string };

/** Lonceng notifikasi dalam aplikasi. Memuat saat dibuka halaman dan tiap 60 detik selama tab terlihat. */
export function NotificationBell({ light = false }: { light?: boolean }) {
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items); setUnread(d.unread);
    } catch { /* abaikan: bukan fitur kritis */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function markAll() {
    try { await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); load(); } catch { /* abaikan */ }
  }

  return (
    <div ref={box} className="relative">
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-lg ${light ? "text-white hover:bg-navy-700" : "text-mist hover:bg-navy-700 hover:text-white"}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] rounded-xl border border-line bg-white p-2 text-ink shadow-lg md:left-0 md:right-auto">
          <div className="flex items-center justify-between px-2 py-1.5"><b className="text-navy">Notifications</b>{unread > 0 && <button className="text-xs font-semibold text-brand" onClick={markAll}>Mark all as read</button>}</div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.map((n) => {
              const inner = <><span className={`block text-sm ${n.read ? "text-ink-soft" : "font-semibold text-navy"}`}>{n.title}</span>{n.body && <span className="block text-xs text-ink-soft">{n.body}</span>}<span className="block text-[11px] text-ink-soft">{tgl(n.at, true)}</span></>;
              return <li key={n.id}>{n.href ? <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2 hover:bg-canvas">{inner}</Link> : <div className="px-2 py-2">{inner}</div>}</li>;
            })}
            {items.length === 0 && <li className="px-2 py-6 text-center text-sm text-ink-soft">No notifications yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
