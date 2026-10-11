"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";

export type NavGroup = { label?: string; items: { href: string; label: string }[] };
const ROLE: Record<string, string> = { participant: "Participant", admin: "Admin", inst_admin: "Institution admin", coach: "Coach" };

export function ShellNav({
  nav, title, user, children,
}: { nav: NavGroup[]; title?: string; user: { name: string; email: string; role: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]); // tutup drawer saat pindah halaman
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const all = nav.flatMap((g) => g.items);
  const best = all.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];

  const links = (
    <nav aria-label="Main menu" className="flex flex-col gap-4">
      {nav.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {g.label && <p className="px-3 text-[11px] font-semibold tracking-wider text-[#8FA6C8]">{g.label.toUpperCase()}</p>}
          {g.items.map((n) => (
            <Link key={n.href} href={n.href} aria-current={best?.href === n.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2.5 text-[15px] font-medium ${best?.href === n.href ? "bg-navy-700 text-white" : "text-mist hover:bg-navy-700 hover:text-white"}`}>
              {n.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const account = (
    <div className="mt-auto border-t border-navy-700 pt-4">
      <div className="mb-2 flex items-center justify-between"><p className="truncate text-sm font-semibold text-white">{user.name}</p><NotificationBell /></div>
      <p className="truncate text-xs text-[#8FA6C8]">{ROLE[user.role] ?? user.role}</p>
      <button
        className="mt-3 w-full rounded-lg border border-[#8FA6C8]/40 px-3 py-2 text-sm font-semibold text-mist hover:bg-navy-700"
        onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}
      >Sign out</button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop / tablet landscape */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-navy p-5 md:flex">
        <Logo />
        {links}
        {account}
      </aside>

      {/* Mobile / portrait top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 md:hidden">
        <Logo />
        <span className="flex items-center gap-1"><NotificationBell light />
        <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-navy-700">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button></span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-navy p-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="h-11 w-11 text-2xl leading-none text-white">×</button>
            </div>
            {links}
            {account}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {title && <div className="hidden border-b border-line bg-white px-6 py-3 text-sm text-ink-soft md:block">{title}</div>}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
