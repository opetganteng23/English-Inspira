"use client";

import { useEffect, useState } from "react";

export const NAV = [
  { id: "how", label: "How it works" },
  { id: "counselor", label: "AI Counselor" },
  { id: "journey", label: "Journey" },
  { id: "institutions", label: "For institutions" },
  { id: "faq", label: "FAQ" },
];

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bagian yang sedang dilihat. Section aktif diberi data-spy="active" (CSS menyorot judulnya dengan penanda emas). */
function useScrollSpy() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter((e): e is HTMLElement => !!e);
    els.forEach((e) => e.setAttribute("data-spy", "idle"));
    const visible = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio); else visible.delete(e.target.id);
      }
      const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      setActive(best);
      els.forEach((el) => el.setAttribute("data-spy", el.id === best ? "active" : "idle"));
    }, { rootMargin: "-25% 0px -45% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}

function go(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  const h = el.querySelector("h2");
  if (h && !reduced()) { h.classList.remove("flash"); void (h as HTMLElement).offsetWidth; h.classList.add("flash"); setTimeout(() => h.classList.remove("flash"), 1400); }
}

export function DesktopNav() {
  const active = useScrollSpy();
  return (
    <nav className="hidden items-center gap-1 text-[15px] font-medium lg:flex" aria-label="Sections">
      {NAV.map((n) => (
        <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); go(n.id); }} aria-current={active === n.id ? "location" : undefined}
          className={`relative rounded-lg px-3.5 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-tint hover:text-brand active:scale-95 ${active === n.id ? "bg-brand-tint text-brand" : "text-ink"}`}>
          {n.label}
          <span className={`absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left rounded-full bg-accent transition-transform duration-300 ${active === n.id ? "scale-x-100" : "scale-x-0"}`} aria-hidden />
        </a>
      ))}
    </nav>
  );
}

/** Menu untuk layar kecil (sebelumnya tautan section tidak ada di ponsel). */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const active = useScrollSpy();
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-navy transition hover:bg-brand-tint active:scale-90">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16" className={`origin-center transition-all duration-300 ${open ? "translate-y-[5px] rotate-45" : ""}`} style={{ transformBox: "fill-box" }} />
          <path d="M4 12h16" className={`transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <path d="M4 17h16" className={`origin-center transition-all duration-300 ${open ? "-translate-y-[5px] -rotate-45" : ""}`} style={{ transformBox: "fill-box" }} />
        </svg>
      </button>
      <div className={`fixed inset-x-0 top-[68px] z-30 origin-top border-b border-line bg-white shadow-xl transition-all duration-300 ${open ? "scale-y-100 opacity-100" : "pointer-events-none scale-y-95 opacity-0"}`} aria-hidden={!open}>
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Sections">
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} tabIndex={open ? 0 : -1} onClick={(e) => { e.preventDefault(); setOpen(false); setTimeout(() => go(n.id), 120); }}
              style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
              className={`rounded-xl px-4 py-3 text-base font-semibold transition-all duration-300 active:scale-[0.98] ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"} ${active === n.id ? "bg-brand-tint text-brand" : "text-ink hover:bg-canvas"}`}>
              {n.label}
            </a>
          ))}
          <a href="/sign-in" tabIndex={open ? 0 : -1} className="mt-1 rounded-xl border border-line-strong px-4 py-3 text-center text-base font-semibold text-navy active:scale-[0.98] sm:hidden">Sign in</a>
        </nav>
      </div>
      {open && <button type="button" aria-label="Close menu" className="fixed inset-0 top-[68px] z-20 bg-black/30" onClick={() => setOpen(false)} />}
    </div>
  );
}
