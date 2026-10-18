"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { compressImage } from "@/lib/compress-image";
import { askConfirm, toast } from "@/components/Feedback";

type A = { overlay: number; auth: string | null; page: string | null };
type Slot = "auth" | "page";

const SLOTS: { slot: Slot; title: string; help: string }[] = [
  { slot: "auth", title: "Sign-in pages", help: "Left panel of Sign in, Create account, Forgot password, and the invitation page." },
  { slot: "page", title: "Other brand pages", help: "Public footer, 404 page, and the maintenance page. Empty = uses the sign-in image." },
];

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Could not read the image")); r.readAsDataURL(b); });

/** Gambar latar panel merek: unggah (dikompres di browser lalu disimpan sebagai base64), pratinjau, hapus, dan kekuatan lapisan terang. */
export function AppearanceSettings() {
  const [a, setA] = useState<A | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(70);
  const [own, setOwn] = useState<Record<Slot, boolean>>({ auth: false, page: false });

  const publish = (n: A) => { setA(n); setOverlay(n.overlay); window.dispatchEvent(new CustomEvent("brand-bg", { detail: n })); try { localStorage.setItem("ei-appearance", JSON.stringify(n)); } catch { /* */ } };
  useEffect(() => {
    api<A>("/api/admin/appearance").then((n) => { setA(n); setOverlay(n.overlay); setOwn({ auth: !!n.auth, page: !!n.page && n.page !== n.auth }); }).catch(() => {});
  }, []);

  async function upload(slot: Slot, f: File | undefined) {
    if (!f) return;
    setBusy(slot);
    try {
      const { blob } = await compressImage(f, 700 * 1024, 1920);
      const n = await api<A>("/api/admin/appearance", { method: "PUT", json: { slot, dataUrl: await toDataUrl(blob) } });
      publish(n); setOwn((o) => ({ ...o, [slot]: true })); toast("Background image saved");
    } catch (x) { toast((x as Error).message, "error"); } finally { setBusy(null); }
  }
  async function remove(slot: Slot) {
    if (!(await askConfirm("Remove this background image? The panel goes back to dark blue.", { danger: true, confirmLabel: "Remove" }))) return;
    setBusy(slot);
    try { publish(await api<A>("/api/admin/appearance", { method: "PUT", json: { slot, dataUrl: null } })); setOwn((o) => ({ ...o, [slot]: false })); toast("Background image removed"); }
    catch (x) { toast((x as Error).message, "error"); } finally { setBusy(null); }
  }
  async function saveOverlay() {
    setBusy("overlay");
    try { publish(await api<A>("/api/admin/appearance", { method: "PUT", json: { overlay } })); toast("Saved"); }
    catch (x) { toast((x as Error).message, "error"); } finally { setBusy(null); }
  }

  if (!a) return null;
  return (
    <section className="card flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">Background images</h2>
        <p className="text-sm text-ink-soft">Replace the dark blue brand panels with a photo. A light layer is placed over the photo so the logo shows without its white card and the text stays readable. Images are compressed (max 1920 px, WebP) and stored in the database.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SLOTS.map(({ slot, title, help }) => {
          const url = a[slot];
          return (
            <div key={slot} className="flex flex-col gap-3 rounded-xl border border-line p-4">
              <div><p className="font-semibold text-navy">{title}</p><p className="text-xs text-ink-soft">{help}</p></div>
              <div className="relative flex h-40 flex-col justify-between overflow-hidden rounded-lg p-4" style={url ? { background: `linear-gradient(rgba(248,250,253,${overlay / 100}),rgba(248,250,253,${overlay / 100})), url("${url}") center/cover` } : { background: "#0A2257" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo.png" alt="" className={`h-9 w-auto self-start ${url ? "" : "rounded-lg bg-white px-2 py-1"}`} />
                <p className={`font-display text-lg font-extrabold ${url ? "text-navy" : "text-white"}`}>Welcome back.</p>
              </div>
              <p className="text-xs text-ink-soft">{url ? (slot === "page" && !own.page ? "Using the sign-in image." : "Custom image set.") : "No image: dark blue."}</p>
              <div className="flex flex-wrap gap-2">
                <label className="btn-outline cursor-pointer !min-h-[40px] !px-4 text-sm">
                  {busy === slot ? "Uploading…" : url && (slot === "auth" || own.page) ? "Replace image" : "Upload image"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy} onChange={(e) => { upload(slot, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {(slot === "auth" ? !!url : own.page) && <button type="button" className="btn-outline !min-h-[40px] !px-4 text-sm text-red-700" disabled={!!busy} onClick={() => remove(slot)}>Remove</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-sm font-semibold text-navy">
          Light layer over the photo: {overlay}%
          <input type="range" min={30} max={95} step={5} value={overlay} onChange={(e) => setOverlay(Number(e.target.value))} />
          <span className="text-xs font-normal text-ink-soft">Higher = text easier to read, photo fainter. 70–80% is usually right.</span>
        </label>
        <button type="button" className="btn-solid !min-h-[44px]" disabled={!!busy || overlay === a.overlay} onClick={saveOverlay}>{busy === "overlay" ? "Saving…" : "Save layer"}</button>
      </div>
    </section>
  );
}
