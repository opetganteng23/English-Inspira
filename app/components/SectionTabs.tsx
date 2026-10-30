"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tab antarhalaman yang berbagi satu menu (mis. Question Bank · Audio · Media). Tampil hanya di halaman utama tab, tidak di halaman turunan. */
export function SectionTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  if (tabs.length < 2 || !tabs.some((t) => t.href === path)) return null;
  return (
    <nav aria-label="Section" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === path ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${t.href === path ? "border-brand text-navy" : "border-transparent text-ink-soft hover:text-navy"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}
