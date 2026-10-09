import ExcelJS from "exceljs";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { decryptField } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ItpSession, ItpRegistration } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Ekspor roster ke mitra penyelenggara. Memuat NIK lengkap, jadi tiap ekspor dicatat di audit log. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Schedule not found");
    await connectDB();
    const s = await ItpSession.findById(params.id).lean();
    if (!s) throw new HttpError(404, "Schedule not found");
    const regs = await ItpRegistration.find({ sessionId: s._id, status: { $ne: "cancelled" } }).sort({ createdAt: 1 }).lean();
    const users = new Map((await User.find({ _id: { $in: regs.map((r) => r.userId) } }).select("email phone").lean()).map((u) => [String(u._id), u]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Roster");
    ws.columns = [
      { header: "registrationId", key: "id", width: 26 }, { header: "Name (as on ID)", key: "name", width: 30 }, { header: "NIK/Paspor", key: "nik", width: 22 },
      { header: "Date of birth", key: "dob", width: 14 }, { header: "Gender", key: "g", width: 8 }, { header: "Email", key: "email", width: 28 }, { header: "WhatsApp", key: "phone", width: 16 },
      { header: "Documents", key: "doc", width: 12 }, { header: "listening", key: "l", width: 10 }, { header: "structure", key: "s", width: 10 }, { header: "reading", key: "r", width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of regs) {
      const u = users.get(String(r.userId));
      ws.addRow({ id: String(r._id), name: r.fullName, nik: decryptField(r.nikEnc), dob: r.birthDate.toISOString().slice(0, 10), g: r.gender, email: u?.email, phone: u?.phone ?? "", doc: r.docStatus, l: r.score?.listening ?? "", s: r.score?.structure ?? "", r: r.score?.reading ?? "" });
    }
    await audit(admin._id, "pii.export", params.id, { rows: regs.length });
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="roster-${params.id}.xlsx"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
