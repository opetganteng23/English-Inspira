import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { refundGrant } from "@/lib/entitlements";
import { audit } from "@/lib/orders";
import { getSetting } from "@/models/Commerce";
import { ItpSession, ItpRegistration } from "@/models/Itp";

/**
 * Reschedule/batal: sampai batas hari sebelum tes (pengaturan), kursi dilepas dan jatah ITP dikembalikan
 * agar peserta bisa memilih jadwal lain. Kebijakan final refund/reschedule ditentukan bisnis (spec bagian 17).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Pendaftaran tidak ditemukan");
    await connectDB();
    const reg = await ItpRegistration.findOne({ _id: params.id, userId: me._id });
    if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
    if (!["submitted", "confirmed"].includes(reg.status)) throw new HttpError(409, "Pendaftaran ini tidak bisa dibatalkan");
    const session = await ItpSession.findById(reg.sessionId).lean();
    const cfg = await getSetting("general", { rescheduleDays: 7 });
    if (session && +session.date - cfg.rescheduleDays * 86_400_000 <= Date.now())
      throw new HttpError(409, `Perubahan jadwal hanya bisa sampai ${cfg.rescheduleDays} hari sebelum tes`);

    // Transisi atomik agar klik ganda tidak mengembalikan jatah dua kali.
    const done = await ItpRegistration.findOneAndUpdate({ _id: reg._id, status: { $in: ["submitted", "confirmed"] } }, { status: "cancelled" });
    if (!done) throw new HttpError(409, "Sudah dibatalkan");
    await ItpSession.updateOne({ _id: reg.sessionId, registered: { $gt: 0 } }, { $inc: { registered: -1 } });
    if (reg.entitlementId) await refundGrant(reg.entitlementId, "itp");
    await audit(me._id, "itp.cancel", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
