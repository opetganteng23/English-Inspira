import type { Types } from "mongoose";
import { HttpError, requireRole } from "./rbac";

// Penulis materi (MTS §10.2): admin, coach, inst_admin. Coach/inst_admin hanya menulis rich text untuk institusinya
// sendiri (materi ber-institutionId, hanya terlihat peserta institusi itu). Materi HTML hanya admin (MTS §19).
export const AUTHOR_ROLES = ["admin", "coach", "inst_admin"] as const;

export async function requireAuthor() {
  return requireRole([...AUTHOR_ROLES]);
}

type U = { role: string; institutionId?: Types.ObjectId | null };

/** Filter daftar/akses materi untuk penulis: admin semua; lainnya hanya milik institusinya. */
export function authorScope(u: U): Record<string, unknown> {
  if (u.role === "admin") return {};
  if (!u.institutionId) throw new HttpError(403, "Akunmu belum terhubung ke institusi");
  return { institutionId: u.institutionId };
}

/** Filter materi yang terlihat peserta: global, atau milik institusinya. */
export const visibleTo = (u: { institutionId?: Types.ObjectId | null }) => ({ institutionId: { $in: [null, u.institutionId ?? null] } });

export function assertCanWrite(u: U, m: { institutionId?: Types.ObjectId | null; kind: string }) {
  if (u.role === "admin") return;
  if (!m.institutionId || String(m.institutionId) !== String(u.institutionId)) throw new HttpError(404, "Materi tidak ditemukan");
  if (m.kind !== "rich") throw new HttpError(403, "Materi HTML hanya dikelola admin");
}
