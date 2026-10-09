import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { cancelSlot, setSlotStatus, updateSlot } from "@/lib/coaching";
import { slotAction, slotInput } from "@/lib/coaching-schemas";

/** Ubah slot (peserta terdaftar diberi tahu bila waktu/tempat berubah). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["coach", "admin"]);
    await updateSlot(me, params.id, slotInput.parse(await req.json()));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

/** Aksi: publish | unpublish | cancel (cancel wajib beralasan; peserta tidak kehilangan kuota). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["coach", "admin"]);
    const b = slotAction.parse(await req.json());
    if (b.action === "cancel") await cancelSlot(me, params.id, b.reason);
    else await setSlotStatus(me, params.id, b.action === "publish" ? "published" : "draft");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
