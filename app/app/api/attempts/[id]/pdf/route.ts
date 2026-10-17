import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isReleased, exemptFromDelay } from "@/lib/attempt-release";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt, ensureReleased } from "@/lib/attempts";
import { attemptResult } from "@/lib/attempt-result";
import { resultPdf, scopeForKind } from "@/lib/result-pdf";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { placement: "PLACEMENT TEST", sim: "SIMULATION TEST", final: "FINAL TEST", practice: "PRACTICE", quiz: "UNIT QUIZ", section: "SECTION TEST" };

/** Ekspor hasil tes dan diagnostic (analisis AI) satu percobaan sebagai PDF. Hanya pemilik (atau admin); tanpa pembahasan per soal. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    if (!exemptFromDelay(user) && !isReleased(attempt)) return NextResponse.json({ error: "Your results are not released yet.", availableAt: attempt.releaseAt }, { status: 423 });
    await ensureReleased(attempt);
    await connectDB();
    const owner = await User.findById(attempt.userId).select("name email targetScore").lean();
    let r = await attemptResult(attempt, test);
    // Analisis AI berjalan di latar dan butuh ±1 menit. Tunggu sebentar agar PDF tidak berisi "masih disiapkan".
    if (r.analysis.status === "pending") {
      for (let i = 0; i < 20 && r.analysis.status === "pending"; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const a = await Attempt.findById(attempt._id).select("aiAnalysis.status").lean();
        if (a?.aiAnalysis?.status && a.aiAnalysis.status !== "pending") r = await attemptResult((await Attempt.findById(attempt._id))!, test);
      }
    }
    const pdf = await resultPdf(scopeForKind({
      name: owner?.name ?? owner?.email ?? "-", testName: r.testName, kindLabel: KIND[r.kind ?? ""] ?? "TEST", finishedAt: r.finishedAt ?? null, durationSec: r.durationSec,
      scoreEst: r.scoreEst ?? null, scoring: r.scoring, level: r.level ? { name: r.level.name, scoreMin: r.level.scoreMin, scoreMax: r.level.scoreMax, quota: r.level.quota } : null,
      equivalents: r.equivalents, previous: r.previous && r.previous.scoreEst != null ? { name: r.previous.name, scoreEst: r.previous.scoreEst } : null, target: owner?.targetScore ?? null,
      sections: r.sectionScores.map((s) => ({ section: s.section ?? "", scaled: s.scaled ?? 0, raw: s.raw ?? 0, total: s.total ?? 0 })),
      topics: (r.topicScores ?? []).map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", score: t.score ?? 0, correct: t.correct ?? 0, total: t.total ?? 0 })),
      analysis: r.analysis as never,
      unanswered: r.unanswered, insights: r.insights, courseProgress: r.courseProgress,
      partial: r.partial && r.percent != null && r.passScore != null ? { percent: r.percent, passScore: r.passScore, passed: !!r.passed } : undefined, summary: r.summary,
      recommendations: r.recommendations.map((x) => ({ course: x.course.title, unit: x.unit.title, topic: x.topic, score: x.score })),
    }, r.kind));
    const slug = r.testName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "result";
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="english-inspira-${slug}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
