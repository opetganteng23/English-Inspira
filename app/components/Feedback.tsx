"use client";

import { useEffect, useRef, useState } from "react";

// Dialog konfirmasi dan notifikasi singkat (toast) yang seragam di seluruh aplikasi, pengganti confirm()/alert() bawaan browser.
// Dipanggil dari mana saja: `if (await askConfirm("Delete this?")) ...` dan `toast("Saved")`.

type Ask = { message: string; title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; resolve: (ok: boolean) => void };
type Toast = { id: number; text: string; kind: "ok" | "error" };

let pushAsk: ((a: Ask) => void) | null = null;
let pushToast: ((t: Omit<Toast, "id">) => void) | null = null;

/** Tanya konfirmasi. Kata hapus/delete/remove/cancel/close otomatis memakai tombol merah. */
export function askConfirm(message: string, opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (!pushAsk) return Promise.resolve(window.confirm(message));
  const danger = opts.danger ?? /\b(delete|remove|deactivate|cancel|close|turn on|log out|sign out|overwrite)\b/i.test(message);
  return new Promise((resolve) => pushAsk!({ message, ...opts, danger, resolve }));
}

export function toast(text: string, kind: "ok" | "error" = "ok") {
  pushToast?.({ text, kind });
}

export function FeedbackHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    pushAsk = (a) => setAsk(a);
    let n = 0;
    pushToast = (t) => {
      const id = ++n;
      setToasts((x) => [...x.slice(-2), { ...t, id }]);
      setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2800);
    };
    return () => { pushAsk = null; pushToast = null; };
  }, []);
  useEffect(() => { if (ask) okBtn.current?.focus(); }, [ask]);
  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };

  return (
    <>
      {ask && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/40 p-4 sm:items-center" onClick={() => close(false)} onKeyDown={(e) => { if (e.key === "Escape") close(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-title" className="font-display text-lg font-extrabold text-navy">{ask.title ?? (ask.danger ? "Are you sure?" : "Please confirm")}</h2>
            <p id="confirm-text" className="mt-2 whitespace-pre-line text-sm text-ink">{ask.message}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-outline" onClick={() => close(false)}>{ask.cancelLabel ?? "Cancel"}</button>
              <button type="button" ref={okBtn} className={ask.danger ? "btn-danger" : "btn-solid"} onClick={() => close(true)}>{ask.confirmLabel ?? (ask.danger ? "Yes, continue" : "OK")}</button>
            </div>
          </div>
        </div>
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <p key={t.id} role="status" className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${t.kind === "ok" ? "bg-navy text-white" : "bg-red-700 text-white"}`}>{t.kind === "ok" ? "✓ " : ""}{t.text}</p>
        ))}
      </div>
    </>
  );
}
