"use client";

import { useEffect } from "react";

/** Dialog yang responsif: layar penuh di ponsel, kartu di desktop. Esc menutup. */
export function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-start sm:overflow-y-auto sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white sm:my-6 sm:max-h-none sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg font-extrabold text-navy sm:text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center text-2xl leading-none text-ink-soft">×</button>
        </div>
        <div className="overflow-y-auto p-4 sm:overflow-visible sm:p-6">{children}</div>
      </div>
    </div>
  );
}
