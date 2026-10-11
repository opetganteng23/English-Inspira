"use client";

import { useEffect } from "react";

/**
 * Di layar sempit, tabel `.table-wrap` tampil sebagai kartu (CSS di globals.css). Komponen ini hanya mengisi `data-label`
 * di tiap sel dari teks kepala kolomnya, termasuk untuk baris yang muncul belakangan (data dimuat, filter, dialog).
 */
export function ResponsiveTables() {
  useEffect(() => {
    let raf = 0;
    const label = () => {
      raf = 0;
      document.querySelectorAll<HTMLTableElement>(".table-wrap table").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((h) => (h as HTMLElement).innerText.trim());
        if (!heads.length) return;
        t.querySelectorAll("tbody tr").forEach((tr) => {
          [...tr.children].forEach((td, i) => {
            const want = (td as HTMLTableCellElement).colSpan > 1 ? "" : heads[i] ?? "";
            if (td.getAttribute("data-label") !== want) td.setAttribute("data-label", want);
          });
        });
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(label); };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
