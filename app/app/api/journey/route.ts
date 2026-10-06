import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { accessSummary } from "@/lib/entitlements";
import { upgradeCredit } from "@/lib/pricing";
import { Attempt } from "@/models/Test";
import { Product } from "@/models/Commerce";
import { ItpRegistration } from "@/models/Itp";

export const dynamic = "force-dynamic";

type Status = "done" | "open" | "locked";

/** English Intelligence Journey: 10 langkah. Status mengikuti produk yang dibeli dan tes yang sudah dikerjakan. */
export async function GET() {
  try {
    const me = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const [access, attempts, regs, journey] = await Promise.all([
      accessSummary(me._id),
      Attempt.find({ userId: me._id, status: "submitted" }).select("kind").lean(),
      ItpRegistration.find({ userId: me._id, status: { $ne: "cancelled" } }).select("status").lean(),
      Product.findOne({ kind: "journey", active: true }).lean(),
    ]);
    const done = (k: string) => attempts.filter((a) => a.kind === k).length;
    const has = (k: string) => (access.tests[k] ?? 0) > 0;
    const st = (isDone: boolean, isOpen: boolean): Status => (isDone ? "done" : isOpen ? "open" : "locked");
    const hasJourney = access.products.some((p) => p.kind === "journey");

    const steps = [
      { key: "trial", title: "Free trial (tes mini)", desc: "42 soal, hasil + 3 pertanyaan ke Konselor AI.", status: st(done("trial") > 0, true), href: "/tes" },
      { key: "diag1", title: "Diagnostic 1", desc: "Peta kemampuan awal per tipe soal.", status: st(done("diagnostic") >= 1, has("diagnostic") || done("diagnostic") >= 1), href: "/tes" },
      { key: "materi1", title: "Materi & latihan fokus", desc: "Belajar dari kelemahan hasil Diagnostic.", status: st(false, access.materials), href: "/materi" },
      { key: "diag2", title: "Diagnostic 2", desc: "Ukur ulang setelah belajar.", status: st(done("diagnostic") >= 2, has("diagnostic") || done("diagnostic") >= 2), href: "/tes" },
      { key: "konsel", title: "Konseling & rencana aksi", desc: "Konselor AI menyusun langkah mingguan.", status: st(false, access.counselor.allowed || access.counselor.mode === "paid"), href: "/konselor" },
      { key: "diag3", title: "Diagnostic 3", desc: "Tinjau perkembangan skor.", status: st(done("diagnostic") >= 3, has("diagnostic") || done("diagnostic") >= 3), href: "/tes" },
      { key: "pred1", title: "Prediction 1", desc: "Simulasi penuh format ITP.", status: st(done("prediction") >= 1, has("prediction") || done("prediction") >= 1), href: "/tes" },
      { key: "diag4", title: "Diagnostic 4", desc: "Perbaiki sisa kelemahan terakhir.", status: st(done("diagnostic") >= 4, has("diagnostic") || done("diagnostic") >= 4), href: "/tes" },
      { key: "pred2", title: "Prediction 2", desc: "Gladi resik sebelum tes resmi.", status: st(done("prediction") >= 2, has("prediction") || done("prediction") >= 2), href: "/tes" },
      { key: "itp", title: "Tes TOEFL ITP resmi", desc: "Daftar jadwal, lengkapi data, ikut tes resmi.", status: st(regs.some((r) => r.status === "done"), access.itp > 0 || regs.length > 0), href: "/itp" },
    ];
    const credit = journey && !hasJourney ? await upgradeCredit(me._id, journey.price) : 0;
    return NextResponse.json({
      steps, counts: { done: steps.filter((s) => s.status === "done").length, open: steps.filter((s) => s.status === "open").length, locked: steps.filter((s) => s.status === "locked").length },
      hasJourney,
      upgrade: journey && !hasJourney ? { productId: String(journey._id), name: journey.name, price: journey.price, credit, pay: Math.max(0, journey.price - credit) } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
