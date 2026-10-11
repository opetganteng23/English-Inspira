"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { UiPrefsSync, PREFS_KEY } from "./UiPrefs";

export type NavItem = { href: string; label: string; icon?: IconName; primary?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };
const ROLE: Record<string, string> = { participant: "Participant", admin: "Admin", inst_admin: "Institution admin", coach: "Coach" };

// Ikon garis sederhana (sesuai mockup v2.4), stroke mengikuti warna teks.
const ICONS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>,
  learn: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5V21" /></>,
  tests: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 11h6M9 15h4" /></>,
  coaching: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  counselor: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
};
export type IconName = keyof typeof ICONS;
const Icon = ({ name }: { name: IconName }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[name]}</svg>
);

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  try { localStorage.removeItem(PREFS_KEY); } catch { /* tanpa storage */ }
  window.location.href = "/";
}

export function ShellNav({
  nav, title, user, variant = "side", children,
}: { nav: NavGroup[]; title?: string; user: { name: string; email: string; role: string }; variant?: "top" | "side"; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]); // tutup drawer saat pindah halaman
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const all = nav.flatMap((g) => g.items);
  const best = all.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  const isCur = (n: NavItem) => best?.href === n.href;

  const groupLinks = (
    <nav aria-label="Main menu" className="flex flex-col gap-4">
      {nav.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {g.label && <p className="px-3 text-[11px] font-semibold tracking-wider text-ink-soft">{g.label.toUpperCase()}</p>}
          {g.items.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isCur(n) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${isCur(n) ? "bg-brand-tint text-brand" : "text-ink hover:bg-surface-2"}`}>
              {n.icon && <Icon name={n.icon} />}{n.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const account = (
    <div className="mt-auto border-t border-line pt-4">
      <div className="mb-1 flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-ink">{user.name}</p><NotificationBell up /></div>
      <p className="truncate text-xs text-ink-soft">{ROLE[user.role] ?? user.role}</p>
      <button className="btn-outline mt-3 w-full" onClick={signOut}>Sign out</button>
    </div>
  );

  const drawer = open && (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
      <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-surface p-5">
        <div className="flex items-center justify-between">
          <Logo dark size={34} />
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl leading-none text-ink hover:bg-surface-2">×</button>
        </div>
        {groupLinks}
        {account}
      </div>
    </div>
  );
  const burger = (
    <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  );

  if (variant === "top") {
    const primary = all.filter((n) => n.primary);
    const more = all.filter((n) => !n.primary);
    return (
      <div className="app-calm min-h-screen">
        <UiPrefsSync />
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
            <Logo dark size={44} />
            <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
              {primary.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isCur(n) ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${isCur(n) ? "bg-brand-tint text-brand" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}>
                  {n.icon && <Icon name={n.icon} />}{n.label}
                </Link>
              ))}
              {more.length > 0 && <MoreMenu items={more} current={best?.href} />}
            </nav>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button onClick={signOut} className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink lg:inline-flex">Sign out</button>
              <span className="lg:hidden">{burger}</span>
            </div>
          </div>
        </header>
        {drawer}
        <main className="mx-auto w-full max-w-[1180px] p-4 sm:p-6 lg:py-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-calm min-h-screen md:flex">
      <UiPrefsSync />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-5 md:flex">
        <Logo dark size={48} />
        {groupLinks}
        {account}
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 md:hidden">
        <Logo dark size={38} />
        <span className="flex items-center gap-1"><NotificationBell />{burger}</span>
      </header>
      {drawer}
      <div className="flex min-w-0 flex-1 flex-col">
        {title && <div className="hidden border-b border-line bg-surface px-6 py-3 text-sm text-ink-soft md:block">{title}</div>}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function MoreMenu({ items, current }: { items: NavItem[]; current?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const active = items.some((i) => i.href === current);
  return (
    <div ref={box} className="relative">
      <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-tint text-brand" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}>
        <Icon name="more" />More
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {items.map((n) => (
            <Link key={n.href} role="menuitem" href={n.href} aria-current={n.href === current ? "page" : undefined}
              className={`block rounded-lg px-3 py-2.5 text-sm ${n.href === current ? "bg-brand-tint font-semibold text-brand" : "text-ink hover:bg-surface-2"}`}>{n.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
