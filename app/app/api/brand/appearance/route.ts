import { NextResponse } from "next/server";
import { publicAppearance } from "@/lib/appearance";

export const dynamic = "force-dynamic";

/** Publik: alamat gambar latar panel merek dan kekuatan lapisan terangnya. */
export async function GET() {
  try {
    return NextResponse.json(await publicAppearance(), { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ overlay: 70, auth: null, page: null });
  }
}
