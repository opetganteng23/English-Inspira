import { NextResponse } from "next/server";
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
    const list = await Attempt.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).select("testId kind status startedAt finishedAt scoreEst sectionScores").lean();
    const tests = new Map((await Test.find({ _id: { $in: list.map((a) => a.testId) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const reports = new Map((await Certificate.find({ userId: user._id, type: "sim_report" }).select("attemptId").lean()).map((c) => [String(c.attemptId), String(c._id)]));
    return NextResponse.json({
      attempts: list.map((a) => ({
        id: String(a._id), name: tests.get(String(a.testId)) ?? "-", kind: a.kind, status: a.status, startedAt: a.startedAt, finishedAt: a.finishedAt ?? null, scoreEst: a.scoreEst ?? null,
        sections: Object.fromEntries(a.sectionScores.map((s) => [s.section, s.scaled])), reportId: reports.get(String(a._id)) ?? null,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
