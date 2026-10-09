import { RateLimiterMemory } from "rate-limiter-flexible";
import { connectDB } from "./db";
import { aiEnabled, askClaude, extractJson, GUARDRAILS, AI_MODEL, AI_MODEL_LIGHT, type CounselorContext } from "./ai";
import { getLevels, getParam } from "./config";
import { aliasFor, analysisResultSchema, checkResult, inputHash, templateResult, toLegacy, type AnalysisResult, type EngineInput } from "./analysis-engine";
import { Attempt } from "@/models/Test";
import { User } from "@/models/User";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import { CounselorThread } from "@/models/Counselor";
import { Analysis, PlanItem, TopicStat, type AnalysisDoc } from "@/models/Learning";
import type { Types } from "mongoose";

// Batas biaya: per peserta dan per institusi per jam. Terlampaui → narasi template (angka tetap tampil).
const perUser = new RateLimiterMemory({ points: 30, duration: 3600 });
const perInst = new RateLimiterMemory({ points: 300, duration: 3600 });

/** Susun masukan Claude dari hasil hitung (`analyses.calculated`) dan statistik akumulatif. Tidak memuat PII. */
export async function buildEngineInput(analysis: AnalysisDoc): Promise<EngineInput | null> {
  const attempt = await Attempt.findById(analysis.attemptId).lean();
  if (!attempt || attempt.status !== "submitted") return null;
  const [user, levels, th, stats] = await Promise.all([User.findById(analysis.userId).select("currentLevelId currentScoreEst").lean(), getLevels(), getParam("weakness"), TopicStat.find({ userId: analysis.userId }).lean()]);
  const calc = (analysis.calculated ?? {}) as { stuck?: string[] };
  const cur = levels.find((l) => String(l._id) === String(user?.currentLevelId));
  const next = cur ? levels.find((l) => l.order === cur.order + 1) : undefined;
  const score = attempt.scoreEst ?? user?.currentScoreEst ?? null;
  const thisAttempt = new Map(attempt.topicScores.map((t) => [`${t.skill}|${t.topic}`, t.score ?? null]));
  const answered = attempt.answers.filter((a) => a.choice != null);
  const times = attempt.answers.map((a) => a.timeSpentSec).filter((x): x is number => typeof x === "number" && x > 0);
  return {
    alias: aliasFor(String(analysis.userId)), kind: attempt.kind ?? analysis.sourceKind, level: cur?.name ?? null, scoreEst: score,
    sections: attempt.sectionScores.map((s) => ({ section: s.section ?? "", raw: s.raw ?? 0, total: s.total ?? 0, scaled: s.scaled ?? 0 })),
    topics: stats.map((t) => ({ topic: t.topic, skill: t.skill, score: Math.round(t.score * 10) / 10, items: t.items, status: t.status, thisAttempt: thisAttempt.get(`${t.skill}|${t.topic}`) ?? null })),
    gapToNextLevel: next && score != null && score < next.scoreMin ? { points: next.scoreMin - score, target: next.scoreMin, nextLevel: next.name } : null,
    behaviour: {
      answered: answered.length, unanswered: attempt.answers.length - answered.length, answerChanges: attempt.answers.reduce((n, a) => n + (a.changes ?? 0), 0),
      avgSecPerAnswer: times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : null,
      stuckTopics: (calc.stuck ?? []).map((k) => k.split("|")[1] ?? k),
    },
    thresholds: th, validTopics: Array.from(new Set(stats.map((t) => t.topic))),
  };
}

type Narrative = { result: AnalysisResult; engine: "claude" | "template"; model?: string; tokensIn: number; tokensOut: number; fallbackReason?: string };

/** Claude (sampai 3 percobaan: 1 + ulang 2×) → bila tetap tidak sah/gagal, template cadangan. Tidak pernah melempar. */
export async function generateNarrative(input: EngineInput, userId: string, institutionId: string | undefined, opts: { allowClaude?: boolean } = {}): Promise<Narrative> {
  const [tpl, prompt] = await Promise.all([getParam("narrative_template"), getParam("analysis_prompt")]);
  const fallback = (reason: string, extra: Partial<Narrative> = {}): Narrative => ({ result: templateResult(input, tpl), engine: "template", tokensIn: 0, tokensOut: 0, fallbackReason: reason, ...extra });
  if (!aiEnabled() || opts.allowClaude === false) return fallback("no_key");
  const model = input.kind === "quiz" ? AI_MODEL_LIGHT() : AI_MODEL();
  if (!model) return fallback("light_kind"); // kuis kecil tanpa model ringan memakai template
  try { await perUser.consume(userId); if (institutionId) await perInst.consume(institutionId); } catch { return fallback("rate_limited"); }

  const system = `${GUARDRAILS}\n${prompt.text}\nBalas HANYA satu objek JSON valid tanpa teks lain: {"summary": string, "strengths": [{"topic","evidence"}], "weaknesses": [{"topic","severity":"weak"|"priority","evidence","likelyCause"}], "gapToNextLevel"?: {"points": number, "target": number}, "recommendations": [{"topic","priority":"high"|"medium"}], "narrative": string, "suggestions": [string]}. Topik HARUS persis dari validTopics. Jangan menulis angka yang tidak ada di data.`;
  const base = `Data analisis (JSON, tanpa identitas):\n${JSON.stringify(input)}`;
  let tokensIn = 0, tokensOut = 0, last = "api_error", feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await askClaude(system, [{ role: "user", content: feedback ? `${base}\n\nJawaban sebelumnya ditolak: ${feedback}. Perbaiki dan balas HANYA JSON.` : base }], 1800, model);
      tokensIn += out.tokensIn; tokensOut += out.tokensOut;
      const parsed = analysisResultSchema.safeParse(extractJson(out.text));
      if (!parsed.success) { last = "invalid_output"; feedback = "bentuk JSON tidak sesuai skema"; continue; }
      const bad = checkResult(parsed.data, input);
      if (bad) { last = "invalid_output"; feedback = bad; continue; }
      return { result: parsed.data, engine: "claude", model: out.model, tokensIn, tokensOut };
    } catch (e) {
      last = (e as Error).name === "SyntaxError" ? "invalid_output" : "api_error";
      feedback = last === "invalid_output" ? "bukan JSON valid" : "";
      console.error("[analysis] percobaan", attempt + 1, "gagal:", (e as Error).message);
      if (last === "api_error") break; // gangguan API: jangan menghabiskan percobaan; job per jam yang mengulang
    }
  }
  return fallback(last, { tokensIn, tokensOut });
}

async function save(a: AnalysisDoc, n: Narrative, hash: string, promptVersion: string) {
  await Analysis.updateOne({ _id: a._id }, {
    status: "ready", narrative: n.result, mock: n.engine === "template", engine: n.engine, model: n.model, promptVersion, tokensIn: n.tokensIn, tokensOut: n.tokensOut, inputHash: hash,
    ...(n.fallbackReason ? { fallbackReason: n.fallbackReason } : { $unset: { fallbackReason: 1 } }),
  });
  await Attempt.updateOne({ _id: a.attemptId }, { aiAnalysis: { status: "ready", ...toLegacy(n.result, n.engine), generatedAt: new Date() } });
}

/** Jalankan analisis (async setelah selesai mengerjakan): `calculated` → `ready`. Klaim atomik: satu panggilan AI per hasil. */
export async function runAnalysis(attemptId: Types.ObjectId | string) {
  await connectDB();
  const a = await Analysis.findOneAndUpdate({ attemptId, status: "calculated", claimedAt: { $exists: false } }, { claimedAt: new Date() }, { new: true });
  if (!a) return;
  await Attempt.updateOne({ _id: attemptId }, { aiAnalysis: { status: "pending", startedAt: new Date() } });
  try {
    const input = await buildEngineInput(a);
    if (!input) throw new Error("Data analisis tidak lengkap");
    const prompt = await getParam("analysis_prompt");
    const hash = inputHash(input, prompt.version);
    // Cache: masukan identik (mis. dibuka ulang) memakai narasi Claude yang sudah ada, tanpa memanggil AI lagi.
    const hit = await Analysis.findOne({ inputHash: hash, status: "ready", engine: "claude", _id: { $ne: a._id } }).select("narrative model").lean();
    const parsed = hit ? analysisResultSchema.safeParse(hit.narrative) : null;
    const n: Narrative = parsed?.success ? { result: parsed.data, engine: "claude", model: hit?.model ?? undefined, tokensIn: 0, tokensOut: 0 } : await generateNarrative(input, String(a.userId), a.institutionId ? String(a.institutionId) : undefined);
    await save(a, n, hash, prompt.version);
  } catch (e) {
    console.error("[analysis] gagal", e);
    await Analysis.updateOne({ _id: a._id }, { status: "failed" });
    await Attempt.updateOne({ _id: attemptId }, { aiAnalysis: { status: "failed", error: "Analisis belum tersedia. Coba lagi." } });
  }
}

export async function retryAnalysis(attemptId: Types.ObjectId | string) {
  await connectDB();
  await Analysis.updateOne({ attemptId, status: "failed" }, { status: "calculated", $unset: { claimedAt: 1 } });
  await Attempt.updateOne({ _id: attemptId, "aiAnalysis.status": "failed" }, { $unset: { aiAnalysis: 1 } });
  void runAnalysis(attemptId);
}

/** Job per jam: narasi yang jatuh ke template karena gangguan API/keluaran tidak sah dicoba lagi (maks 3×, dalam 24 jam). */
export async function retryFallbackAnalyses() {
  await connectDB();
  if (!aiEnabled()) return { retried: 0, upgraded: 0 };
  const list = await Analysis.find({ status: "ready", engine: "template", fallbackReason: { $in: ["api_error", "invalid_output", "rate_limited"] }, retries: { $lt: 3 }, createdAt: { $gte: new Date(Date.now() - 24 * 3_600_000) } }).limit(20);
  let upgraded = 0;
  for (const a of list) {
    await Analysis.updateOne({ _id: a._id }, { $inc: { retries: 1 } });
    const input = await buildEngineInput(a);
    if (!input) continue;
    const prompt = await getParam("analysis_prompt");
    const n = await generateNarrative(input, String(a.userId), a.institutionId ? String(a.institutionId) : undefined);
    if (n.engine === "claude") { await save(a, n, inputHash(input, prompt.version), prompt.version); upgraded++; }
  }
  return { retried: list.length, upgraded };
}

/** Profil + riwayat untuk system prompt Konselor. */
export async function buildCounselorContext(userId: Types.ObjectId | string): Promise<CounselorContext> {
  await connectDB();
  const [user, attempts, threads, reg, plan, topics] = await Promise.all([
    User.findById(userId).select("name targetScore goal").lean(),
    Attempt.find({ userId, status: "submitted" }).sort({ finishedAt: -1 }).limit(5).lean(),
    CounselorThread.find({ userId }).select("actionPlan").lean(),
    ItpRegistration.findOne({ userId, status: { $in: ["submitted", "confirmed"] } }).sort({ createdAt: -1 }).lean(),
    PlanItem.find({ userId, status: "active" }).sort({ priority: 1, dueAt: 1 }).limit(8).lean(),
    TopicStat.find({ userId, status: { $in: ["weak", "priority"] } }).sort({ score: 1 }).limit(6).lean(),
  ]);
  const session = reg ? await ItpSession.findById(reg.sessionId).select("date").lean() : null;
  const latest = await Analysis.findOne({ userId, status: "ready" }).sort({ createdAt: -1 }).select("narrative").lean();
  const narrative = (latest?.narrative as { summary?: string } | undefined)?.summary;
  return {
    name: user?.name ?? null, targetScore: user?.targetScore ?? null, goal: user?.goal ?? null, examDate: session?.date ? session.date.toISOString().slice(0, 10) : null,
    attempts: attempts.map((a) => ({ kind: a.kind ?? "", date: (a.finishedAt ?? a.startedAt).toISOString().slice(0, 10), scoreEst: a.scoreEst ?? 0, sections: a.sectionScores.map((s) => ({ section: s.section ?? "", scaled: s.scaled ?? 0 })) })),
    weaknesses: topics.map((t) => `${t.topic} (${Math.round(t.score)}%)`),
    // Rencana resmi (sistem/coach) adalah sumber tunggal; AI hanya mengusulkan, tidak mengubahnya (MTS §17).
    openPlan: [...plan.map((p) => p.title), ...threads.flatMap((t) => t.actionPlan.filter((p) => !p.done).map((p) => p.text ?? ""))].slice(0, 10),
    ...(narrative ? { latestAnalysis: narrative } : {}),
  };
}
