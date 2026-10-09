import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { encryptField } from "@/lib/crypto";
import { enqueueMail } from "@/lib/mailq";
import { audit } from "@/lib/audit";
import { Asset } from "@/models/Asset";
import { User } from "@/models/User";
import { ItpSession, ItpRegistration } from "@/models/Itp";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
const schema = z.object({
  sessionId: oid,
  fullName: z.string().trim().min(2).max(100),
  nik: z.string().trim().regex(/^(\d{16}|[A-Za-z0-9]{5,20})$/, "NIK harus 16 digit, atau nomor paspor 5–20 karakter"),
  birthDate: z.coerce.date(),
  gender: z.enum(["L", "P"]),
  idPhotoAssetId: oid,
  facePhotoAssetId: oid,
  agree: z.literal(true, { message: "Centang pernyataan bahwa data sudah benar" }),
});

export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    const b = schema.parse(await req.json());
    const age = (Date.now() - +b.birthDate) / (365.25 * 86_400_000);
    if (age < 14 || age > 90) throw new HttpError(400, "Tanggal lahir tidak valid");
    await connectDB();

    // Foto harus milik peserta sendiri dan bertanda sensitif (diunggah lewat alur dokumen).
    const assets = await Asset.find({ _id: { $in: [b.idPhotoAssetId, b.facePhotoAssetId] }, ownerId: me._id, sensitive: true }).select("_id").lean();
    if (assets.length !== (b.idPhotoAssetId === b.facePhotoAssetId ? 1 : 2)) throw new HttpError(400, "Foto dokumen tidak valid. Unggah ulang.");

    const session = await ItpSession.findById(b.sessionId).lean();
    if (!session || session.status !== "open" || session.date <= new Date()) throw new HttpError(404, "Jadwal tidak tersedia");
    if (await ItpRegistration.exists({ userId: me._id, sessionId: session._id, status: { $ne: "cancelled" } })) throw new HttpError(409, "Kamu sudah terdaftar di jadwal ini");

    if (await ItpRegistration.exists({ userId: me._id, status: { $in: ["submitted", "confirmed"] } })) throw new HttpError(409, "Kamu masih punya pendaftaran ITP aktif. Batalkan dulu untuk memilih jadwal lain.");
    const seat = await ItpSession.findOneAndUpdate({ _id: session._id, status: "open", $expr: { $lt: ["$registered", "$quota"] } }, { $inc: { registered: 1 } }, { new: true });
    if (!seat) throw new HttpError(409, "Kuota jadwal ini sudah penuh. Pilih jadwal lain.");

    let reg;
    try {
      reg = await ItpRegistration.create({
        userId: me._id, sessionId: session._id, fullName: b.fullName, nikEnc: encryptField(b.nik), nikLast4: b.nik.slice(-4),
        birthDate: b.birthDate, gender: b.gender, idPhotoAssetId: b.idPhotoAssetId, facePhotoAssetId: b.facePhotoAssetId,
      });
    } catch (err) { // gagal menyimpan: kembalikan kursi dan jatah
      await ItpSession.updateOne({ _id: session._id }, { $inc: { registered: -1 } });
      throw err;
    }
    // Nama sesuai identitas menjadi nama akun (terkunci setelah ini).
    await User.updateOne({ _id: me._id }, { name: b.fullName, birthDate: b.birthDate, gender: b.gender });
    await audit(me._id, "itp.register", String(reg._id), { sessionId: String(session._id) });
    await enqueueMail(me.email, "itp_registered", { name: b.fullName, title: session.title, date: session.date, place: session.place });
    return NextResponse.json({ id: String(reg._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
