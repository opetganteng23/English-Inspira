import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { audit } from "./audit";
import { disableMember } from "./participants";
import { User } from "@/models/User";
import { Asset } from "@/models/Asset";
import { CounselorThread } from "@/models/Counselor";
import { ItpRegistration, Certificate } from "@/models/Itp";
import { MaterialProgress } from "@/models/Material";
import { Otp } from "@/models/Otp";
import { Notification } from "@/models/Access";

/**
 * Penghapusan data pribadi (UU PDP; MTS §8): prosedur admin yang tercatat di audit_logs.
 * Data pribadi dihapus/dianonimkan; riwayat belajar tanpa identitas dan sertifikat tanpa nama tetap ada.
 */
export async function eraseUserData(userId: Types.ObjectId | string, actorId: Types.ObjectId | string, reason: string) {
  await connectDB();
  const u = await User.findById(userId);
  if (!u) throw new HttpError(404, "Pengguna tidak ditemukan");
  if (u.role === "admin") throw new HttpError(409, "Akun admin tidak dihapus lewat prosedur ini");
  if (await ItpRegistration.exists({ userId: u._id, status: { $in: ["submitted", "confirmed"] } }))
    throw new HttpError(409, "Batalkan pendaftaran ITP yang aktif dulu.");

  await disableMember(u._id); // enrollment nonaktif + kursi kembali
  await Promise.all([
    Asset.deleteMany({ ownerId: u._id, sensitive: true }), // KTP & pas foto
    CounselorThread.deleteMany({ userId: u._id }),
    MaterialProgress.deleteMany({ userId: u._id }),
    Notification.deleteMany({ userId: u._id }),
    Otp.deleteMany({ email: u.email }),
    ItpRegistration.updateMany({ userId: u._id }, { $set: { fullName: "Dihapus", nikEnc: "deleted", nikLast4: "", docNote: "" }, $unset: { idPhotoAssetId: 1, facePhotoAssetId: 1 } }),
    Certificate.updateMany({ userId: u._id }, { $set: { "data.name": "Akun dihapus" } }),
  ]);
  await User.updateOne({ _id: u._id }, { $set: { email: `deleted-${u._id}@deleted.invalid`, name: "Akun dihapus", status: "disabled", deletedAt: new Date() }, $unset: { phone: 1, nik: 1, birthDate: 1, gender: 1 } });
  await audit(actorId, "data.erase", String(u._id), { reason });
}
