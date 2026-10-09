import { NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";
import { getCurrentUser } from "./auth";
import type { Role, UserDoc } from "@/models/User";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/**
 * Panggil di awal setiap handler terproteksi.
 * Akun berstatus "invited" (belum menyetujui penggunaan data) ditolak kecuali allowInvited.
 */
export async function requireRole(roles: Role[], opts: { allowInvited?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (!roles.includes(user.role)) throw new HttpError(403, "No access");
  if (user.status === "invited" && !opts.allowInvited) throw new HttpError(403, "Complete the data consent first", "consent_required");
  return user;
}

/** Peran yang datanya dibatasi pada satu institusi. Filter ini wajib di level query, bukan hanya di UI. */
export const INSTITUTION_SCOPED: Role[] = ["inst_admin", "coach"];

export function scopeByInstitution<T = UserDoc>(
  user: Pick<UserDoc, "role" | "institutionId">,
  filter: QueryFilter<T> = {}
): QueryFilter<T> {
  if (INSTITUTION_SCOPED.includes(user.role)) {
    if (!user.institutionId) throw new HttpError(403, "The account is not linked to an institution yet");
    return { ...filter, institutionId: user.institutionId } as QueryFilter<T>;
  }
  return filter;
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}
