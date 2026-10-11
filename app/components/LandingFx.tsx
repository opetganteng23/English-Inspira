"use client";

import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Muncul halus saat masuk layar. Tanpa JS atau dengan "reduce motion" konten tetap terlihat (lihat noscript di Landing). */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !("IntersectionObserver" in window)) { setOn(true); setSettled(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); setTimeout(() => setSettled(true), delay + 900); }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={`reveal ${on ? "is-visible" : ""} ${className}`} style={{ "--d": settled ? "0ms" : `${delay}ms` } as React.CSSProperties}>{children}</div>;
}

/** Angka menghitung naik saat halaman dimuat. Nilai akhir tampil bila animasi dimatikan. */
export function CountUp({ to, ms = 1300 }: { to: number; ms?: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

/** Header lengket yang menambah bayangan setelah halaman digulir. */
export function HeaderShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <header className={`${className} ${scrolled ? "shadow-[0_8px_24px_-16px_rgba(10,34,87,0.45)]" : ""}`}>{children}</header>;
}
