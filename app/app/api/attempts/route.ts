import { NextResponse } from "next/server";
import { isPartialKind, percentOf } from "@/lib/attempt-kinds";
import { exemptFromDelay } from "@/lib/attempt-release";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Attempt, Test } from "@/models/Test";
import { Certificate } from "@/models/Itp";

export const dynamic = "force-dynamic";

/** Riwayat pengerjaan milik sendiri (Tes Saya & Hasil Tes). */
export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    await connectDB();
    const list = await Attempt.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).select("testId kind status startedAt finishedAt scoreEst sectionScores releaseAt").lean();
    const tests = new Map((await Test.find({ _id: { $in: list.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const reports = new Map((await Certificate.find({ userId: user._id, type: "sim_report" }).select("attemptId").lean()).map((c) => [String(c.attemptId), String(c._id)]));
    return NextResponse.json({
      attempts: list.map((a) => {
        const held = !!a.releaseAt && a.releaseAt > new Date() && !exemptFromDelay(user); // hasil ditahan: skor belum boleh terlihat
        return {
          id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, status: a.status, startedAt: a.startedAt, finishedAt: a.finishedAt ?? null, scoreEst: held || isPartialKind(a.kind) ? null : a.scoreEst ?? null, percent: !held && isPartialKind(a.kind) && a.status === "submitted" ? percentOf(a.sectionScores) : null,
          sections: held ? {} : Object.fromEntries(a.sectionScores.map((s) => [s.section, s.scaled])), reportId: held ? null : reports.get(String(a._id)) ?? null,
          availableAt: held ? a.releaseAt : null,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
