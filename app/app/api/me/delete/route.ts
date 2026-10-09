import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Notification } from "@/models/Access";
import { User } from "@/models/User";

/**
 * Pengajuan penghapusan data (hak UU PDP). Penghapusan dilakukan admin lewat prosedur yang tercatat (MTS §8);
 * di sini hanya mencatat pengajuan dan memberi tahu semua admin.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant", "coach", "inst_admin"]);
    z.object({ confirm: z.literal("HAPUS") }).parse(await req.json());
    await connectDB();
    await audit(me._id, "data.erase_requested", String(me._id));
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    if (admins.length) await Notification.insertMany(admins.map((a) => ({ userId: a._id, type: "erase_request", payload: { userId: String(me._id), email: me.email } })));
    return NextResponse.json({ ok: true, message: "Pengajuan dicatat. Admin akan memproses penghapusan datamu." });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Ketik "HAPUS" untuk konfirmasi' }, { status: 400 });
    return handleError(e);
  }
}
