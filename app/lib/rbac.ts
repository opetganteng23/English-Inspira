import { NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";
import { getCurrentUser } from "./auth";
import type { Role, UserDoc } from "@/models/User";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Panggil di awal setiap handler terproteksi. */
export async function requireRole(roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Belum masuk");
  if (!roles.includes(user.role)) throw new HttpError(403, "Tidak punya akses");
  return user;
}

/** inst_admin hanya boleh melihat peserta di institusinya; filter ini wajib di level query. */
export function scopeByInstitution<T = UserDoc>(
  user: Pick<UserDoc, "role" | "institutionId">,
  filter: QueryFilter<T> = {}
): QueryFilter<T> {
  if (user.role === "inst_admin") {
    if (!user.institutionId) throw new HttpError(403, "Akun institusi belum terhubung");
    return { ...filter, institutionId: user.institutionId } as QueryFilter<T>;
  }
  return filter;
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}
