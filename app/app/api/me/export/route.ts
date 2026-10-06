import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { decryptField } from "@/lib/crypto";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { Order, Entitlement } from "@/models/Commerce";
import { CounselorThread } from "@/models/Counselor";
import { ItpRegistration, Certificate } from "@/models/Itp";
import { MaterialProgress } from "@/models/Material";

export const dynamic = "force-dynamic";

/** Hak akses data (UU PDP): unduh semua data pribadi milik sendiri sebagai JSON. */
export async function GET() {
  try {
    const me = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const [user, attempts, orders, ents, threads, regs, certs, progress] = await Promise.all([
      User.findById(me._id).lean(),
      Attempt.find({ userId: me._id }).select("-aiAnalysis.error").lean(),
      Order.find({ userId: me._id }).select("-snapToken -lastNotification").lean(),
      Entitlement.find({ userId: me._id }).lean(),
      CounselorThread.find({ userId: me._id }).lean(),
      ItpRegistration.find({ userId: me._id }).lean(),
      Certificate.find({ userId: me._id }).lean(),
      MaterialProgress.find({ userId: me._id }).lean(),
    ]);
    const data = {
      exportedAt: new Date(), user,
      attempts, orders, entitlements: ents, counselorThreads: threads, certificates: certs, materialProgress: progress,
      itpRegistrations: regs.map(({ nikEnc, ...r }) => ({ ...r, nik: decryptField(nikEnc) })), // NIK milik sendiri didekripsi
    };
    return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="data-saya.json"', "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
