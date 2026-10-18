import { BG_SLOTS, type BgSlot, getBgImage } from "@/lib/appearance";

export const dynamic = "force-dynamic";

/** Publik: gambar latar dari base64 di database, dikirim sebagai berkas gambar biasa dan di-cache lama (URL berversi). */
export async function GET(_req: Request, { params }: { params: { slot: string } }) {
  if (!BG_SLOTS.includes(params.slot as BgSlot)) return new Response("Not found", { status: 404 });
  const d = await getBgImage(params.slot as BgSlot).catch(() => null);
  const m = d?.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" } });
}
