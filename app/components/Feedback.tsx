"use client";

import { useEffect, useRef, useState } from "react";

// Dialog konfirmasi dan notifikasi singkat (toast) yang seragam di seluruh aplikasi, pengganti confirm()/alert() bawaan browser.
// Dipanggil dari mana saja: `if (await askConfirm("Delete this?")) ...` dan `toast("Saved")`.

type Ask = { message: string; title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; impact?: string[]; typeWord?: string; reason?: "required" | "optional"; resolve: (ok: boolean, reason?: string) => void };
export type DangerOpts = { title: string; confirmLabel: string; impact?: string[]; typeWord?: string; reason?: "required" | "optional" };
type Toast = { id: number; text: string; kind: "ok" | "error" };

let pushAsk: ((a: Ask) => void) | null = null;
let pushToast: ((t: Omit<Toast, "id">) => void) | null = null;

/** Tanya konfirmasi. Kata hapus/delete/remove/cancel/close otomatis memakai tombol merah. */
export function askConfirm(message: string, opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (!pushAsk) return Promise.resolve(window.confirm(message));
  const danger = opts.danger ?? /\b(delete|remove|deactivate|cancel|close|turn on|log out|sign out|overwrite)\b/i.test(message);
  return new Promise((resolve) => pushAsk!({ message, ...opts, danger, resolve }));
}

/**
 * Aksi berbahaya dengan pola seragam (Sesi 5.3): ringkasan dampak, alasan (wajib/opsional, dicatat di audit log oleh API),
 * dan bila perlu ketik kata konfirmasi. Mengembalikan alasan ("" bila opsional dan kosong), atau null bila dibatalkan.
 */
export function askDanger(message: string, opts: DangerOpts): Promise<string | null> {
  if (!pushAsk) return Promise.resolve(window.confirm(message) ? "" : null);
  return new Promise((resolve) => pushAsk!({ message, ...opts, danger: true, resolve: (ok, reason) => resolve(ok ? reason ?? "" : null) }));
}

export function toast(text: string, kind: "ok" | "error" = "ok") {
  pushToast?.({ text, kind });
}

export function FeedbackHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const okBtn = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  const [why, setWhy] = useState("");
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
  useEffect(() => { setTyped(""); setWhy(""); if (ask && !ask.typeWord && !ask.reason) okBtn.current?.focus(); }, [ask]);
  const close = (ok: boolean) => { ask?.resolve(ok, why.trim()); setAsk(null); };
  const blocked = !!ask && ((!!ask.typeWord && typed.trim().toUpperCase() !== ask.typeWord.toUpperCase()) || (ask.reason === "required" && why.trim().length < 3));

  return (
    <>
      {ask && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/40 p-4 sm:items-center" onClick={() => close(false)} onKeyDown={(e) => { if (e.key === "Escape") close(false); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-title" className="font-display text-lg font-extrabold text-navy">{ask.title ?? (ask.danger ? "Are you sure?" : "Please confirm")}</h2>
            <p id="confirm-text" className="mt-2 whitespace-pre-line text-sm text-ink">{ask.message}</p>
            {ask.impact && ask.impact.length > 0 && <ul className="mt-3 list-disc rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800">{ask.impact.map((x) => <li key={x}>{x}</li>)}</ul>}
            {ask.reason && <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-navy">Reason {ask.reason === "optional" ? "(optional)" : ""}<input className="field font-normal" value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} autoFocus placeholder="Saved in the audit log" /></label>}
            {ask.typeWord && <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-navy">Type <span className="font-mono">{ask.typeWord}</span> to confirm<input className="field font-normal" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus={!ask.reason} autoComplete="off" /></label>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-outline" onClick={() => close(false)}>{ask.cancelLabel ?? "Cancel"}</button>
              <button type="button" ref={okBtn} disabled={blocked} className={`${ask.danger ? "btn-danger" : "btn-solid"} disabled:opacity-50`} onClick={() => close(true)}>{ask.confirmLabel ?? (ask.danger ? "Yes, continue" : "OK")}</button>
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
