// Akun peserta demo dengan riwayat nyata: placement → 2 simulasi (skor naik ke 500-an), jawaban per soal,
// topic stats, analisis (Claude bila ada kunci, selain itu template), study plan, laporan simulasi, dan satu percakapan Konselor AI.
// Semua dihitung lewat mesin yang sama dengan aplikasi; tidak ada angka yang ditulis tangan.
// Email TIDAK dikirim (transport SMTP dimatikan untuk proses ini). Login tetap lewat OTP ke email tersebut.
//
// Jalankan: npx tsx --env-file=.env.local scripts/seed-demo-participant.ts [email] [--password <pw>] [--reset]

// Matikan SMTP sebelum modul mailer dimuat (ia membaca env saat dimuat).
delete process.env.MAIL_USER;
delete process.env.MAIL_APP_PASSWORD;

const EMAIL = (process.argv.slice(2).find((a) => a.includes("@")) ?? "davdchndra@gmail.com").toLowerCase();
const RESET = process.argv.includes("--reset");
const PW = (() => { const i = process.argv.indexOf("--password"); return i > 0 ? process.argv[i + 1] : undefined; })();
const DAY = 86_400_000;

// Topik yang sengaja sering salah agar analisis punya pola yang jelas.
const WEAK = new Set(["subject-verb", "article", "conditional", "passive", "inference", "vocab", "reference"]);
// [listening, structure, reading] jumlah benar per pengerjaan
const PLAN = [
  { kind: "placement", daysAgo: 56, correct: [6, 6, 6] },
  { kind: "sim", daysAgo: 28, correct: [8, 6, 7] },
  { kind: "sim", daysAgo: 5, correct: [9, 7, 8] },
] as const;

(async () => {
  const mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("../lib/db");
  const { seedTests } = await import("../lib/seed");
  const { getParam } = await import("../lib/config");
  const { gradeAttempt } = await import("../lib/scoring");
  const { computeTopicScores } = await import("../lib/topics");
  const { applyPlacement } = await import("../lib/placement");
  const { processAttemptLearning } = await import("../lib/learning-pipeline");
  const { runAnalysis, buildCounselorContext } = await import("../lib/analysis");
  const { ensureSimReport } = await import("../lib/certificates");
  const { evaluateLevelUp } = await import("../lib/level-up");
  const { counselorReply } = await import("../lib/ai");
  const { hashPassword } = await import("../lib/password");
  const { User } = await import("../models/User");
  const { Institution } = await import("../models/Institution");
  const { Enrollment, MailJob } = await import("../models/Access");
  const { Test, Attempt } = await import("../models/Test");
  const { Question } = await import("../models/Question");
  const { TopicStat, PlanItem, Analysis } = await import("../models/Learning");
  const { CounselorThread } = await import("../models/Counselor");
  const { CoachingQuota } = await import("../models/Config");
  const { Certificate } = await import("../models/Itp");
  const { Notification } = await import("../models/Access");

  await connectDB();
  const startedAt = new Date();
  await seedTests(); // idempoten: hanya mengisi tes contoh bila belum ada

  let user = await User.findOne({ email: EMAIL });
  if (user && user.role !== "participant") throw new Error(`${EMAIL} exists with role ${user.role}; refusing to touch it`);
  if (user && (await Attempt.exists({ userId: user._id }))) {
    if (!RESET) { console.log(`${EMAIL} already has test history. Run with --reset to rebuild it.`); await mongoose.disconnect(); return; }
    const uid = user._id;
    for (const M of [Attempt, TopicStat, PlanItem, Analysis, CounselorThread, CoachingQuota, Certificate, Notification] as unknown as { deleteMany(f: object): Promise<unknown> }[]) await M.deleteMany({ userId: uid });
    await User.updateOne({ _id: uid }, { $unset: { currentLevelId: 1, currentScoreEst: 1, placementAttemptId: 1 }, $set: { levelHistory: [] } });
    user = await User.findById(uid);
    console.log("reset: previous demo history removed");
  }

  // Institusi demo (dibuat bila belum ada).
  const now = Date.now();
  let inst = await Institution.findOne({ code: "EIDEMO" });
  if (!inst) inst = await Institution.create({ name: "English Inspira Demo", code: "EIDEMO", seats: 10, seatsUsed: 0, contractStart: new Date(now - 90 * DAY), contractEnd: new Date(now + 365 * DAY) });

  if (!user) {
    await Institution.updateOne({ _id: inst._id }, { $inc: { seatsUsed: 1 } });
    user = await User.create({ email: EMAIL, name: "Demo Participant", role: "participant", institutionId: inst._id, status: "active", consentAt: new Date(now - 60 * DAY), targetScore: 550, goal: "scholarship" });
  } else {
    await User.updateOne({ _id: user._id }, { status: "active", consentAt: user.consentAt ?? new Date(now - 60 * DAY), targetScore: user.targetScore ?? 550 });
  }
  await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), ...(PW ? { passwordHash: await hashPassword(PW) } : {}) } });
  if (!(await Enrollment.exists({ userId: user._id, status: "active" })))
    await Enrollment.create({ userId: user._id, institutionId: user.institutionId ?? inst._id, startsAt: new Date(now - 60 * DAY), expiresAt: inst.contractEnd });

  const conv = await getParam("score_conversion");
  for (const step of PLAN) {
    const test = await Test.findOne({ kind: step.kind, active: true }).sort({ createdAt: 1 }).lean();
    if (!test) throw new Error(`No active ${step.kind} test`);
    const ids = test.sections.flatMap((s) => s.questionIds.map(String));
    const qs = await Question.find({ _id: { $in: ids } }).select("answerKey tags type options").lean();
    const byId = new Map(qs.map((q) => [String(q._id), q]));

    // Jawaban: per section, soal topik lemah diisi salah lebih dulu; sisanya benar sampai target terpenuhi.
    const answers: { qid: unknown; firstChoice: number; choice: number; changes: number; timeSpentSec: number }[] = [];
    test.sections.forEach((s, si) => {
      const list = s.questionIds.map(String).sort((a, b) => Number(WEAK.has(String(byId.get(a)?.type))) - Number(WEAK.has(String(byId.get(b)?.type))));
      const need = step.correct[si] ?? 0;
      list.forEach((id, i) => {
        const q = byId.get(id)!;
        const n = Math.max(2, q.options?.length ?? 4);
        const right = i < need;
        const choice = right ? q.answerKey : (q.answerKey + 1 + (i % (n - 1))) % n;
        const hesitant = !right && i % 3 === 0;
        answers.push({ qid: q._id, firstChoice: hesitant ? q.answerKey : choice, choice, changes: hesitant ? 1 : 0, timeSpentSec: 25 + ((i * 7) % 40) + (s.name === "reading" ? 30 : 0) });
      });
    });

    const start = new Date(now - step.daysAgo * DAY);
    const attempt = await Attempt.create({ userId: user._id, institutionId: user.institutionId, testId: test._id, kind: step.kind, startedAt: start, sectionStartedAt: start, sectionIdx: test.sections.length - 1, answers });
    const keys = new Map<string, number>(qs.map((q) => [String(q._id), q.answerKey]));
    const amap = new Map<string, number | undefined>(answers.map((a) => [String(a.qid), a.choice]));
    const graded = gradeAttempt(conv, test.sections.map((s) => ({ name: s.name as never, questionIds: s.questionIds.map(String) })), keys, amap);
    attempt.set({ ...graded, topicScores: computeTopicScores(qs, amap, keys), status: "submitted", finishedAt: new Date(start.getTime() + 38 * 60_000) });
    await attempt.save();

    // Efek samping yang sama dengan finalize(), tetapi ditunggu satu per satu.
    if (step.kind === "placement") await applyPlacement(attempt);
    else await User.updateOne({ _id: user._id }, { currentScoreEst: attempt.scoreEst });
    if (step.kind === "sim") await ensureSimReport(attempt._id);
    await processAttemptLearning(attempt);
    if (step.kind === "sim") await evaluateLevelUp(attempt);
    await runAnalysis(attempt._id);
    const a = await Analysis.findOne({ attemptId: attempt._id }).select("status engine").lean();
    console.log(`${step.kind.padEnd(9)} ${start.toISOString().slice(0, 10)}  score ${attempt.scoreEst}  [${attempt.sectionScores.map((x) => `${x.section} ${x.raw}/${x.total}=${x.scaled}`).join(", ")}]  analysis: ${a?.status}/${a?.engine ?? "-"}`);
  }

  // Satu percakapan Konselor AI tentang simulasi terakhir.
  const last = await Attempt.findOne({ userId: user._id, kind: "sim", status: "submitted" }).sort({ finishedAt: -1 });
  if (last && !(await CounselorThread.exists({ userId: user._id, attemptId: last._id }))) {
    const q = "What should I focus on in the next two weeks to reach 550?";
    const ctx = await buildCounselorContext(user._id);
    const { result, mock } = await counselorReply(ctx, [], q);
    await CounselorThread.create({
      userId: user._id, attemptId: last._id, title: "Test result",
      messages: [{ role: "user", content: q, at: new Date() }, { role: "assistant", content: result.reply, at: new Date(), mock }],
      actionPlan: (result.actionPlan ?? []).map((p) => ({ text: p.text, done: false, dueAt: p.dueInDays ? new Date(Date.now() + p.dueInDays * DAY) : undefined })),
    });
    console.log(`counselor: 1 conversation (${mock ? "rule-based" : "Claude"})`);
  }

  // Email yang terantre selama seeding tidak dikirim (SMTP dimatikan); bersihkan dari antrean.
  const removed = await MailJob.deleteMany({ to: EMAIL, createdAt: { $gte: startedAt } });
  const u = await User.findById(user._id).lean();
  console.log(`done: ${EMAIL} · score ${u?.currentScoreEst} · topics ${await TopicStat.countDocuments({ userId: user._id })} · plan items ${await PlanItem.countDocuments({ userId: user._id })} · mails discarded ${removed.deletedCount}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
