import { connectDB } from "./db";
import { Setting, getSetting } from "@/models/Settings";

// Gambar latar panel merek (login, footer, 404, pemeliharaan). Gambar disimpan sebagai data URL base64 di
// koleksi Setting (satu dokumen per slot), metadata kecil terpisah supaya pembacaan rutin tidak memuat gambar.
export const BG_SLOTS = ["auth", "page"] as const;
export type BgSlot = (typeof BG_SLOTS)[number];
export const BG_MAX_CHARS = 1_400_000; // ~1 MB biner setelah base64
export const DATA_URL = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export type AppearanceMeta = { overlay: number; versions: Partial<Record<BgSlot, number>> };
const META_DEFAULTS: AppearanceMeta = { overlay: 70, versions: {} };

export async function getAppearanceMeta() {
  await connectDB();
  return getSetting<AppearanceMeta>("appearance", META_DEFAULTS);
}

/** URL publik per slot (versi di query supaya bisa di-cache lama). Slot "page" memakai gambar login bila kosong. */
export async function publicAppearance() {
  const m = await getAppearanceMeta();
  const url = (s: BgSlot) => (m.versions[s] ? `/api/brand/bg/${s}?v=${m.versions[s]}` : null);
  const auth = url("auth");
  return { overlay: m.overlay, auth, page: url("page") ?? auth };
}

export async function getBgImage(slot: BgSlot) {
  await connectDB();
  const s = await Setting.findOne({ key: `appearance_bg_${slot}` }).lean();
  const v = s?.value as { dataUrl?: string } | undefined;
  return v?.dataUrl ?? null;
}

export async function setBgImage(slot: BgSlot, dataUrl: string | null) {
  await connectDB();
  const m = await getAppearanceMeta();
  const versions = { ...m.versions };
  if (dataUrl) {
    await Setting.updateOne({ key: `appearance_bg_${slot}` }, { value: { dataUrl } }, { upsert: true });
    versions[slot] = Date.now();
  } else {
    await Setting.deleteOne({ key: `appearance_bg_${slot}` });
    delete versions[slot];
  }
  await Setting.updateOne({ key: "appearance" }, { value: { ...m, versions } }, { upsert: true });
}

export async function setOverlay(overlay: number) {
  const m = await getAppearanceMeta();
  await Setting.updateOne({ key: "appearance" }, { value: { ...m, overlay } }, { upsert: true });
}
