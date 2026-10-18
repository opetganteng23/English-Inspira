"use client";

import { useState } from "react";

/** Nomor halaman yang ditampilkan: 1 … (sekitar halaman ini) … terakhir. */
export function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => set.add(n));
  const nums = [...set].sort((a, b) => a - b), out: (number | "…")[] = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

/**
 * Navigasi halaman: "Showing x-y of z", jumlah baris per halaman, Pertama/Sebelumnya, nomor halaman, Berikutnya/Terakhir, dan lompat ke halaman.
 */
export function Pager({ page, pages, total, size, onPage, onSize, sizes = [25, 50, 100, 200], compact = false }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void; onSize?: (s: number) => void; sizes?: number[]; compact?: boolean }) {
  const [jump, setJump] = useState("");
  const from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size);
  const go = (p: number) => onPage(Math.min(pages, Math.max(1, p)));
  const btn = "inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-line bg-white px-2 text-sm font-semibold text-navy hover:bg-brand-tint disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
      <div className="flex flex-wrap items-center gap-3">
        <span>Showing <b className="text-navy">{from.toLocaleString("en-US")}–{to.toLocaleString("en-US")}</b> of <b className="text-navy">{total.toLocaleString("en-US")}</b></span>
        {onSize && !compact && (
          <label className="flex items-center gap-2">Rows per page
            <select className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-navy" value={size} onChange={(e) => onSize(Number(e.target.value))}>{sizes.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>
        )}
      </div>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button className={btn} disabled={page <= 1} onClick={() => go(1)} aria-label="First page" title="First page">«</button>
          <button className={btn} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page" title="Previous page">‹</button>
          {pageList(page, pages).map((n, i) => n === "…"
            ? <span key={`e${i}`} className="px-1">…</span>
            : <button key={n} className={`${btn} ${n === page ? "!border-brand !bg-brand !text-white" : ""}`} aria-current={n === page ? "page" : undefined} onClick={() => go(n)}>{n}</button>)}
          <button className={btn} disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page" title="Next page">›</button>
          <button className={btn} disabled={page >= pages} onClick={() => go(pages)} aria-label="Last page" title="Last page">»</button>
          {!compact && (
            <form className="ml-2 flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const n = Number(jump); if (n) go(n); setJump(""); }}>
              <label htmlFor="pager-jump">Go to</label>
              <input id="pager-jump" className="h-9 w-16 rounded-lg border border-line bg-white px-2 text-center text-navy" inputMode="numeric" placeholder={String(page)} value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))} />
            </form>
          )}
        </div>
      )}
    </nav>
  );
}
