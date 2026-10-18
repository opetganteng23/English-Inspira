import { NextResponse } from "next/server";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { BG_SLOTS, BG_MAX_CHARS, DATA_URL, publicAppearance, setBgImage, setOverlay } from "@/lib/appearance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await publicAppearance());
  } catch (e) {
    return handleError(e);
  }
}

const body = z.union([
  z.object({ slot: z.enum(BG_SLOTS), dataUrl: z.string().max(BG_MAX_CHARS, "Image is too large (max about 1 MB).").regex(DATA_URL, "Use a JPG, PNG, or WebP image.").nullable() }),
  z.object({ overlay: z.number().int().min(0).max(95) }),
]);

/** Ganti/hapus gambar latar satu slot (base64), atau atur kekuatan lapisan terang. */
export async function PUT(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = body.parse(await req.json());
    if ("slot" in b) {
      await setBgImage(b.slot, b.dataUrl);
      await audit(admin._id, "settings.appearance", b.slot, { set: !!b.dataUrl, chars: b.dataUrl?.length ?? 0 });
    } else {
      await setOverlay(b.overlay);
      await audit(admin._id, "settings.appearance", "overlay", b);
    }
    return NextResponse.json(await publicAppearance());
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
