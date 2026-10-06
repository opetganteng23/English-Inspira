import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { accessSummary } from "@/lib/entitlements";
import { User } from "@/models/User";
import { Attempt, Test } from "@/models/Test";
import { CounselorThread } from "@/models/Counselor";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { Product } from "@/models/Commerce";

export const dynamic = "force-dynamic";

/** Data Beranda peserta: skor, langkah berikutnya, produk aktif, rencana aksi, dan saran pembelian. */
export async function GET() {
  try {
    const me = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const [u, attempts, access, threads, regs, inProgress] = await Promise.all([
      User.findById(me._id).select("name targetScore goal institutionId").lean(),
      Attempt.find({ userId: me._id, status: "submitted" }).sort({ finishedAt: 1 }).select("kind scoreEst sectionScores finishedAt testId").lean(),
      accessSummary(me._id),
      CounselorThread.find({ userId: me._id }).select("actionPlan").lean(),
      ItpRegistration.find({ userId: me._id, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean(),
      Attempt.findOne({ userId: me._id, status: "in_progress" }).select("_id").lean(),
    ]);
    const tests = new Map((await Test.find({ _id: { $in: attempts.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const last = attempts[attempts.length - 1];
    const target = u?.targetScore ?? null;
    const reg = regs.find((r) => ["submitted", "confirmed"].includes(r.status));
    const session = reg ? await ItpSession.findById(reg.sessionId).lean() : null;
    const nextSession = await ItpSession.findOne({ status: "open", date: { $gt: new Date() } }).sort({ date: 1 }).lean();

    // Langkah berikutnya mengikuti kondisi nyata akun (urutan prioritas).
    let next: { title: string; body: string; cta: string; href: string } | null = null;
    if (inProgress) next = { title: "Lanjutkan tesmu", body: "Ada tes yang sedang berjalan. Waktunya terus berjalan di server.", cta: "Lanjutkan", href: `/ruang-tes/${inProgress._id}` };
    else if (!attempts.some((a) => a.kind === "trial")) next = { title: "Mulai dengan free trial", body: "42 soal, ±37 menit. Hasilnya langsung dianalisis AI dan kamu dapat 3 pertanyaan gratis ke Konselor.", cta: "Mulai free trial", href: "/tes" };
    else if (access.itp > 0 && !reg) next = { title: "Pendaftaran ITP resmi sudah dibayar. Pilih jadwal tesmu.", body: nextSession ? `Jadwal terdekat: ${nextSession.date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })} · ${Math.max(0, nextSession.quota - nextSession.registered)} kursi tersisa` : "Belum ada jadwal terbuka.", cta: "Pilih jadwal", href: "/itp" };
    else if (reg && session) next = { title: "Tes ITP resmimu sudah terjadwal", body: `${session.title} · ${session.date.toLocaleDateString("id-ID", { dateStyle: "full" })}`, cta: "Lihat pendaftaran", href: "/itp" };

    const gap = last?.scoreEst && target ? Math.max(0, target - last.scoreEst) : null;
    const suggestion = last && gap !== null && gap > 0 && !(access.tests.sim > 0)
      ? { title: "Ambil 1 Tes Simulasi lagi sebelum tes resmi", body: `Skormu masih ${gap} poin di bawah target. Tes simulasi menunjukkan apakah kamu sudah siap.`, product: await Product.findOne({ slug: "sim-1", active: true }).select("name price").lean() }
      : null;

    return NextResponse.json({
      name: u?.name ?? null, target, goal: u?.goal ?? null, hasInstitution: !!u?.institutionId,
      progress: attempts.map((a) => ({ id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, score: a.scoreEst, at: a.finishedAt })),
      last: last ? { id: String(last._id), name: tests.get(String(last.testId)) ?? "-", score: last.scoreEst, delta: attempts.length > 1 ? (last.scoreEst ?? 0) - (attempts[attempts.length - 2].scoreEst ?? 0) : null, sections: last.sectionScores } : null,
      next, suggestion: suggestion ? { ...suggestion, product: suggestion.product ? { name: suggestion.product.name, price: suggestion.product.price } : null } : null,
      access, plan: threads.flatMap((t) => t.actionPlan.map((p) => ({ id: String(p._id), text: p.text, done: p.done }))).slice(0, 8),
    });
  } catch (e) {
    return handleError(e);
  }
}
