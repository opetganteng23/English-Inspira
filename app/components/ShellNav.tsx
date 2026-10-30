"use client";

import { askConfirm } from "@/components/Feedback";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";

// feature: hanya tampil bila saklar fitur menyala; afterPlacement: peserta tahap 1 (belum ada hasil placement dirilis) tidak melihatnya.
export type NavGroup = { label?: string; collapsed?: boolean; items: { href: string; label: string; feature?: "aiCounselor"; afterPlacement?: boolean }[] };
const ROLE: Record<string, string> = { participant: "Participant", admin: "Admin", inst_admin: "Institutions", coach: "Coach" };

export function ShellNav({
  nav, title, search, user, children,
}: { nav: NavGroup[]; title?: string; search?: boolean; user: { name: string; email: string; role: string; avatarId?: string | null }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]); // tutup drawer saat pindah halaman
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const all = nav.flatMap((g) => g.items);
  const best = all.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  // Tombol Back: selalu di halaman turunan (mis. /admin/materials/:id); di halaman menu lain (selain menu pertama)
  // bila sebelumnya sudah membuka halaman lain di aplikasi ini, mis. Institutions → Participants.
  const [hops, setHops] = useState(0);
  useEffect(() => {
    try { const n = Number(sessionStorage.getItem("ei-hops") ?? "0") + 1; sessionStorage.setItem("ei-hops", String(n)); setHops(n); } catch { setHops(1); }
  }, [path]);
  const home = all[0]?.href;
  const isSubpage = (!!best && path !== best.href) || (path !== home && hops > 1);
  const backTo = best && path !== best.href ? best.href : home ?? "/";

  // Kelompok menu berlabel bisa dilipat. Status disimpan di browser; kelompok yang memuat halaman aktif selalu terbuka.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setClosed(JSON.parse(localStorage.getItem("ei-nav-closed") ?? "{}")); } catch { /* penyimpanan tidak tersedia */ } }, []);
  const toggle = (label: string) => setClosed((c) => { const n = { ...c, [label]: !c[label] }; try { localStorage.setItem("ei-nav-closed", JSON.stringify(n)); } catch { /* abaikan */ } return n; });
  const showLabels = nav.filter((g) => g.label).length > 0 && all.length > 7; // menu pendek tidak perlu dilipat

  const links = (
    <nav aria-label="Main menu" className="flex flex-col gap-2">
      {nav.map((g, gi) => {
        const hasActive = g.items.some((n) => n.href === best?.href);
        const foldable = !!g.label && showLabels;
        const isOpen = !foldable || hasActive || !(closed[g.label!] ?? g.collapsed ?? false); // collapsed: tertutup sampai dibuka
        const id = `nav-group-${gi}`;
        return (
        <div key={gi} className="flex flex-col gap-1">
          {g.label && (foldable
            ? <button type="button" aria-expanded={isOpen} aria-controls={id} disabled={hasActive} onClick={() => toggle(g.label!)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold tracking-wider text-ink-soft hover:bg-brand-tint hover:text-navy disabled:cursor-default disabled:hover:bg-transparent">
                <span>{g.label.toUpperCase()}{!isOpen && <span className="ml-2 rounded-full bg-brand-tint px-1.5 py-0.5 text-[10px] text-brand">{g.items.length}</span>}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className={`transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
              </button>
            : <p className="px-3 text-[11px] font-semibold tracking-wider text-ink-soft">{g.label.toUpperCase()}</p>)}
          <div id={id} hidden={!isOpen} className={isOpen ? "flex flex-col gap-1" : "hidden"}>
          {g.items.map((n) => (
            <Link key={n.href} href={n.href} aria-current={best?.href === n.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2.5 text-[15px] font-medium ${best?.href === n.href ? "bg-brand font-semibold text-white shadow-sm" : "text-ink hover:bg-brand-tint hover:text-navy"}`}>
              {n.label}
            </Link>
          ))}
          </div>
        </div>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-auto border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-sm font-bold text-brand">
            {user.avatarId
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/assets/${user.avatarId}`} alt="" className="h-full w-full object-cover" />
              : (user.name || "?")[0].toUpperCase()}
          </span>
          <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
        </span><NotificationBell /></div>
      <p className="truncate text-xs text-ink-soft">{ROLE[user.role] ?? user.role}</p>
      <button
        className="mt-3 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-brand-tint"
        onClick={async () => { if (!(await askConfirm("You will need to sign in again to continue.", { title: "Log out?", confirmLabel: "Log out", danger: true }))) return; await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}
      >Sign out</button>
    </div>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-clip md:flex-row">
      {/* Desktop / tablet landscape */}
      <aside className="hidden h-full w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-cloud p-4 md:flex lg:w-[264px] lg:p-5">
        <Logo dark />
        {links}
        {account}
      </aside>

      {/* Mobile / portrait top bar */}
      <header className="z-30 flex shrink-0 items-center justify-between border-b border-line bg-cloud px-3 py-2 md:hidden">
        <Logo dark />
        <span className="flex items-center gap-1"><NotificationBell />
        <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-navy hover:bg-brand-tint">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button></span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-cloud p-5">
            <div className="flex items-center justify-between">
              <Logo dark />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="h-11 w-11 text-2xl leading-none text-navy">×</button>
            </div>
            {links}
            {account}
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {(title || isSubpage || search) && (
          <div className="sticky top-0 z-20 hidden items-center gap-3 border-b border-line bg-white px-6 py-2.5 text-sm text-ink-soft md:flex">
            {isSubpage && (
              <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(backTo))}
                className="-ml-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold text-ink hover:bg-canvas">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
                Back
              </button>
            )}
            {title}
            {search && <div className="ml-auto w-full max-w-md"><GlobalSearch /></div>}
          </div>
        )}
        {search && <div className="border-b border-line bg-white px-3 py-2 md:hidden"><GlobalSearch /></div>}
        {isSubpage && (
          <div className="flex items-center gap-1 border-b border-line bg-white px-3 py-2 text-sm font-semibold text-ink md:hidden">
            <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(backTo))}
              className="flex min-h-[44px] items-center gap-1 rounded-lg px-1.5 hover:bg-canvas">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              Back
            </button>
          </div>
        )}
        <main className="w-full min-w-0 flex-1 p-4 sm:p-5 lg:p-6 xl:px-8 2xl:px-10">{children}</main>
      </div>
    </div>
  );
}
