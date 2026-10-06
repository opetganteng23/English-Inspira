import { signAudioToken } from "./audio-store";
import { hasMaterials } from "./entitlements";
import { Material } from "@/models/Material";
import type { Types } from "mongoose";

export function slugify(t: string) {
  const s = t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || "materi";
}

export async function uniqueSlug(title: string, exceptId?: Types.ObjectId | string) {
  const base = slugify(title);
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const clash = await Material.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
    if (!clash) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Ganti penanda audio dengan URL bertanda tangan berumur 10 menit (audio tidak punya URL publik). */
export async function injectAudio(html: string, materialId: string) {
  const ids = new Set<string>();
  html.replace(/data-audio-id="([0-9a-f]{24})"/g, (_m, id) => (ids.add(id), ""));
  html.replace(/ei-audio:([0-9a-f]{24})/g, (_m, id) => (ids.add(id), ""));
  let out = html;
  for (const id of Array.from(ids)) {
    const url = `/api/audio/${id}?token=${await signAudioToken(id, `material:${materialId}`)}`;
    out = out.split(`data-audio-id="${id}"`).join(`data-audio-id="${id}" src="${url}" controlslist="nodownload"`).split(`ei-audio:${id}`).join(url);
  }
  return out;
}

export async function canReadMaterial(user: { _id: Types.ObjectId; role: string }, access: string) {
  return access === "free" || user.role === "admin" || (await hasMaterials(user._id));
}
