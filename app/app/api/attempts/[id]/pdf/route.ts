import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isReleased, exemptFromDelay } from "@/lib/attempt-release";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { attemptResult } from "@/lib/attempt-result";
import { resultPdf } from "@/lib/result-pdf";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { placement: "PLACEMENT TEST", sim: "SIMULATION TEST", final: "FINAL TEST", practice: "PRACTICE", quiz: "QUIZ" };

/** Ekspor hasil tes dan diagnostic (analisis AI) satu percobaan sebagai PDF. Hanya pemilik (atau admin); tanpa pembahasan per soal. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    if (!exemptFromDelay(user) && !isReleased(attempt)) return NextResponse.json({ error: "Your results are not released yet.", availableAt: attempt.releaseAt }, { status: 423 });
    await connectDB();
    const [r, owner] = await Promise.all([
      attemptResult(attempt, test, user.role),
      User.findById(attempt.userId).select("name email targetScore").lean(),
    ]);
    const pdf = await resultPdf({
      name: owner?.name ?? owner?.email ?? "-", testName: r.testName, kindLabel: KIND[r.kind ?? ""] ?? "TEST", finishedAt: r.finishedAt ?? null, durationSec: r.durationSec,
      scoreEst: r.scoreEst ?? null, scoring: r.scoring, level: r.level ? { name: r.level.name, scoreMin: r.level.scoreMin, scoreMax: r.level.scoreMax, quota: r.level.quota } : null,
      equivalents: r.equivalents, previous: r.previous && r.previous.scoreEst != null ? { name: r.previous.name, scoreEst: r.previous.scoreEst } : null, target: owner?.targetScore ?? null,
      sections: r.sectionScores.map((s) => ({ section: s.section ?? "", scaled: s.scaled ?? 0, raw: s.raw ?? 0, total: s.total ?? 0 })),
      topics: (r.topicScores ?? []).map((t) => ({ skill: t.skill ?? "", topic: t.topic ?? "", score: t.score ?? 0, correct: t.correct ?? 0, total: t.total ?? 0 })),
      analysis: r.analysis as never,
      recommendations: r.recommendations.map((x) => ({ course: x.course.title, unit: x.unit.title, topic: x.topic, score: x.score })),
    });
    const slug = r.testName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "result";
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="english-inspira-${slug}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
