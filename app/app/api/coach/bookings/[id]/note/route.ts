import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { noteInput } from "@/lib/coaching-schemas";
import { Booking, SessionNote } from "@/models/Coaching";

/** Catatan sesi: `private` hanya coach/admin, `shared` terlihat peserta. inst_admin tidak punya akses (MTS §4). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["coach", "admin"]);
    const b = noteInput.parse(await req.json());
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Booking tidak ditemukan");
    await connectDB();
    const bk = await Booking.findById(params.id);
    if (!bk || bk.status === "cancelled") throw new HttpError(404, "Booking tidak ditemukan");
    if (me.role !== "admin" && String(bk.coachId) !== String(me._id)) throw new HttpError(403, "Bukan sesi milikmu");
    await SessionNote.updateOne(
      { bookingId: bk._id },
      { $set: { ...b, userId: bk.userId, coachId: bk.coachId, institutionId: bk.institutionId } },
      { upsert: true }
    );
    await audit(me._id, "session.note", params.id, { levelUp: b.recommendLevelUp });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
