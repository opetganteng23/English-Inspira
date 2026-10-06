"use client";

declare global { interface Window { snap?: { pay: (token: string, cb: Record<string, (r?: unknown) => void>) => void } } }

export function loadSnap(clientKey: string, production: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (window.snap) return resolve();
    const s = document.createElement("script");
    s.src = production ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat Midtrans. Periksa koneksi internet."));
    document.body.appendChild(s);
  });
}

