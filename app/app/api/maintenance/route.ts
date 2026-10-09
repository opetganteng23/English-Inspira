import { NextResponse } from "next/server";
import { getMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/** Publik: dipakai middleware dan halaman pemeliharaan. Gagal baca DB = dianggap tidak dalam pemeliharaan. */
export async function GET() {
  try {
    const m = await getMaintenance();
    return NextResponse.json({ on: m.on, message: m.message }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ on: false, message: "" }, { headers: { "Cache-Control": "no-store" } });
  }
}
