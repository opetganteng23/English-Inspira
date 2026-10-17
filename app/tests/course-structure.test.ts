import { describe, it, expect, afterAll } from "vitest";
import { templateResult, allowedNumbers, type EngineInput } from "@/lib/analysis-engine";
import { PART_TEMPLATES } from "@/lib/course-scaffold";

describe("kerangka course baku", () => {
  it("enam bagian TOEFL ITP, tiap bagian dimulai dengan modul pengantar", () => {
    expect(PART_TEMPLATES.map((t) => t.part)).toEqual(["listening_a", "listening_b", "listening_c", "structure", "written_expression", "reading"]);
    for (const t of PART_TEMPLATES) expect(t.modules[0]).toMatch(/^Pengantar/);
  });
});

describe("narasi dengan kemajuan course", () => {
  const input: EngineInput = {
    alias: "p-x", kind: "sim", level: "Basic", scoreEst: 413, sections: [], topics: [{ topic: "verb-form", skill: "grammar", score: 30, items: 10, status: "priority", thisAttempt: 30 }],
    gapToNextLevel: { points: 47, target: 460, nextLevel: "Intermediate" }, behaviour: { answered: 100, unanswered: 40, answerChanges: 3, avgSecPerAnswer: 30, stuckTopics: [] },
    thresholds: { weak: 60, priority: 40, minItems: 5 }, validTopics: ["verb-form"],
    courseProgress: [{ part: "structure", title: "Structure", unitsDone: 3, unitsTotal: 8, quizAvg: 62, sectionTestBest: 55, sectionTestPassed: false }],
  };
  it("template menyebut unit, rata-rata quiz, dan ujian per bagian; angkanya termasuk angka yang sah", () => {
    const r = templateResult(input, { summary: "S {score}", strong: "A", weak: "B {weak}", gap: "G {gap}", suggestion: "T" });
    expect(r.narrative).toMatch(/Course progress: Structure: 3 of 8 units done, quiz average 62%, section test 55%/);
    const ok = allowedNumbers(input);
    for (const n of [3, 8, 62, 55]) expect(ok.has(n)).toBe(true);
  });
});

// MongoDB in-memory; tidak menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("struktur course dan ujian per bagian (database in-memory)", () => {
  it("kerangka, hasil ujian per bagian, penguncian, kemajuan, dan bobot quiz", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("course_structure_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { Course, CourseModule, CourseProgress, Unit, UnitProgress } = await import("@/models/Course");
    const { Test, Attempt } = await import("@/models/Test");
    const { TopicStat } = await import("@/models/Learning");
    const { User } = await import("@/models/User");
    const { scaffoldLevel } = await import("@/lib/course-scaffold");
    const { recordSectionTestResult, courseUnitsComplete } = await import("@/lib/units");
    const { courseLocks } = await import("@/lib/course-access");
    const { courseProgressFor } = await import("@/lib/course-progress");
    const { checkCourseRefs } = await import("@/lib/course-admin");
    const { updateTopicStats } = await import("@/lib/topic-stats");
    const { getParam } = await import("@/lib/config");

    // 1. Kerangka: 6 course, 23 modul dan unit; Preview only; aman diulang.
    const level = new Types.ObjectId();
    expect(await scaffoldLevel(String(level))).toEqual({ created: 6, skipped: 0, modules: 23, units: 23 });
    expect(await scaffoldLevel(String(level))).toEqual({ created: 0, skipped: 6, modules: 0, units: 0 });
    const courses = await Course.find({ levelId: level }).sort({ order: 1 }).lean();
    expect(courses.map((c) => c.part)).toEqual(["listening_a", "listening_b", "listening_c", "structure", "written_expression", "reading"]);
    expect(courses.every((c) => c.previewMode === true && c.active === true)).toBe(true);
    expect(await CourseModule.countDocuments({ courseId: { $in: courses.map((c) => c._id) } })).toBe(23);
    expect(await Unit.countDocuments({ courseId: { $in: courses.map((c) => c._id) } })).toBe(23);

    // 2. Rujukan ujian per bagian harus bertipe Section test.
    const plain = await Test.create({ name: "Biasa", kind: "sim", sections: [] });
    await expect(checkCourseRefs({ prerequisiteCourseIds: [], sectionTestId: String(plain._id) })).rejects.toThrow(/Section test/);
    const sec = await Test.create({ name: "Structure Section Test", kind: "section", sections: [] });
    await expect(checkCourseRefs({ prerequisiteCourseIds: [], sectionTestId: String(sec._id) })).resolves.toBeUndefined();

    // 3. Hasil ujian per bagian: skor terbaik tidak turun, lulus tetap, jumlah percobaan bertambah.
    const structure = courses.find((c) => c.part === "structure")!;
    await Course.updateOne({ _id: structure._id }, { sectionTestId: sec._id, requireSectionTest: true, previewMode: false });
    const user = await User.create({ email: "peserta@airnav.co.id", name: "P", role: "participant", status: "active", currentLevelId: level });
    const mkAttempt = (raw: number, total: number) => Attempt.create({
      userId: user._id, testId: sec._id, courseId: structure._id, kind: "section", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), finishedAt: new Date(),
      sectionScores: [{ section: "structure", raw, total, scaled: 40 }],
    });
    const a1 = await mkAttempt(5, 10);
    expect(await recordSectionTestResult((await Attempt.findById(a1._id))!)).toEqual({ percent: 50, passed: false });
    const a2 = await mkAttempt(8, 10);
    expect(await recordSectionTestResult((await Attempt.findById(a2._id))!)).toEqual({ percent: 80, passed: true });
    const a3 = await mkAttempt(3, 10);
    await recordSectionTestResult((await Attempt.findById(a3._id))!);
    const cp = (await CourseProgress.findOne({ userId: user._id, courseId: structure._id }).lean())!;
    expect(cp).toMatchObject({ sectionTestBest: 80, sectionTestPassed: true, sectionTestAttempts: 3 });

    // 4. Penguncian: course berikutnya terkunci sampai ujian per bagian lulus (bila diwajibkan), walau semua unit selesai.
    const reading = courses.find((c) => c.part === "reading")!;
    const sUnits = await Unit.find({ courseId: structure._id }).lean();
    for (const u of sUnits) await UnitProgress.create({ userId: user._id, unitId: u._id, courseId: structure._id, status: "completed" });
    expect(await courseUnitsComplete(user._id, structure._id)).toBe(true);
    const next = { _id: reading._id, prerequisiteCourseIds: [structure._id] };
    await CourseProgress.updateOne({ userId: user._id, courseId: structure._id }, { sectionTestPassed: false });
    expect((await courseLocks(user._id, [next])).get(String(reading._id))).toMatchObject({ locked: true });
    await CourseProgress.updateOne({ userId: user._id, courseId: structure._id }, { sectionTestPassed: true });
    expect((await courseLocks(user._id, [next])).get(String(reading._id))).toMatchObject({ locked: false });
    await Course.updateOne({ _id: structure._id }, { requireSectionTest: false });
    await CourseProgress.updateOne({ userId: user._id, courseId: structure._id }, { sectionTestPassed: false });
    expect((await courseLocks(user._id, [next])).get(String(reading._id))).toMatchObject({ locked: false }); // tidak diwajibkan: hanya penanda kemajuan

    // 5. Kemajuan per bagian untuk diagnostic: hanya course yang sudah ada aktivitasnya.
    await Course.updateMany({ levelId: level }, { previewMode: false });
    const rows = await courseProgressFor(user._id, level);
    expect(rows.map((r) => r.part)).toEqual(["structure"]);
    expect(rows[0]).toMatchObject({ unitsDone: 5, unitsTotal: 5, sectionTest: { best: 80, passed: false, attempts: 3 }, hasSectionTest: true });
    expect(await courseProgressFor(user._id, undefined)).toEqual([]);

    // 6. Bobot quiz: quiz 2 soal menggeser statistik sebanding (2 dari minItems); ujian per bagian berbobot penuh.
    const alpha = await getParam("alpha"), th = await getParam("weakness");
    await TopicStat.create({ userId: user._id, skill: "grammar", topic: "verb-form", score: 50, items: 10, status: "weak" });
    await updateTopicStats(user._id, undefined, null, [{ skill: "grammar", topic: "verb-form", correct: 2, total: 2, score: 100 }], "quiz");
    const w = Math.min(1, 2 / th.minItems);
    const expectedQuiz = Math.round((alpha * w * 100 + (1 - alpha * w) * 50) * 10) / 10;
    expect((await TopicStat.findOne({ userId: user._id, topic: "verb-form" }).lean())!.score).toBe(expectedQuiz);
    await TopicStat.updateOne({ userId: user._id, topic: "verb-form" }, { score: 50, items: 10 });
    await updateTopicStats(user._id, undefined, null, [{ skill: "grammar", topic: "verb-form", correct: 2, total: 2, score: 100 }], "section");
    expect((await TopicStat.findOne({ userId: user._id, topic: "verb-form" }).lean())!.score).toBe(Math.round((alpha * 100 + (1 - alpha) * 50) * 10) / 10);
  }, 240_000);
});
