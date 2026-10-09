import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Info kursi & kontrak institusi (halaman Peserta/undangan). Tidak ada lagi kode self-join: peserta hanya diundang. */
export async function GET(req: Request) {
  try {
    const { inst, scoped } = await instContext(req);
    return NextResponse.json({ name: inst.name, seats: inst.seats, used: await User.countDocuments(scoped({ status: { $ne: "disabled" } })), contractStart: inst.contractStart ?? null, contractEnd: inst.contractEnd ?? null, status: inst.status });
  } catch (e) {
    return handleError(e);
  }
}
