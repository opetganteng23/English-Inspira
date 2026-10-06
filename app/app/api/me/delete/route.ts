import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { destroySession } from "@/lib/auth";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { User } from "@/models/User";
import { Asset } from "@/models/Asset";
import { CounselorThread } from "@/models/Counselor";
import { ItpRegistration, Certificate } from "@/models/Itp";
import { Order } from "@/models/Commerce";
import { MaterialProgress } from "@/models/Material";
import { Otp } from "@/models/Otp";

/**
 * Hapus akun (UU PDP): data pribadi dihapus/dianonimkan. Data transaksi (order, sertifikat) dipertahankan
 * tanpa identitas karena kewajiban pembukuan/verifikasi. Admin tidak bisa menghapus diri lewat jalur ini.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    const { confirm } = z.object({ confirm: z.literal("HAPUS") }).parse(await req.json());
    void confirm;
    await connectDB();
    if (await ItpRegistration.exists({ userId: me._id, status: { $in: ["submitted", "confirmed"] } }))
      throw new HttpError(409, "Batalkan pendaftaran ITP yang aktif dulu sebelum menghapus akun.");

    await Promise.all([
      Asset.deleteMany({ ownerId: me._id, sensitive: true }), // KTP & pas foto
      CounselorThread.deleteMany({ userId: me._id }),
      MaterialProgress.deleteMany({ userId: me._id }),
      Otp.deleteMany({ email: me.email }),
      ItpRegistration.updateMany({ userId: me._id }, { $set: { fullName: "Dihapus", nikEnc: "deleted", nikLast4: "", docNote: "" }, $unset: { idPhotoAssetId: 1, facePhotoAssetId: 1 } }),
    ]);
    // Sertifikat tetap bisa diverifikasi, tetapi tanpa nama; order tetap ada untuk pembukuan, tanpa data pembeli.
    await Certificate.updateMany({ userId: me._id }, { $set: { "data.name": "Akun dihapus" } });
    await Order.updateMany({ userId: me._id }, { $unset: { buyer: 1 } });
    await User.updateOne({ _id: me._id }, { $set: { email: `deleted-${me._id}@deleted.invalid`, name: "Akun dihapus", status: "suspended", deletedAt: new Date() }, $unset: { phone: 1, nik: 1, birthDate: 1, gender: 1, institutionId: 1 } });
    await audit(me._id, "account.delete", String(me._id));
    destroySession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Ketik "HAPUS" untuk konfirmasi' }, { status: 400 });
    return handleError(e);
  }
}
