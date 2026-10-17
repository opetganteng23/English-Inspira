import { describe, it, expect, afterAll } from "vitest";

// Laporan hasil tidak boleh memuat teks soal, opsi, kunci, penjelasan, atau transkrip (bank soal tidak boleh bocor). MongoDB in-memory.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("laporan hasil tanpa soal (database in-memory)", () => {
  it("hasil hanya berisi agregat per section dan jenis soal", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("no_leak_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Attempt, Test } = await import("@/models/Test");
    const { Question } = await import("@/models/Question");
    const { seedTests } = await import("@/lib/seed");
    const { attemptResult } = await import("@/lib/attempt-result");
    await seedTests();
    const test = (await Test.findOne({ kind: "placement" }).lean())!;
    const user = await User.create({ email: "peserta@airnav.co.id", name: "Peserta", role: "participant", status: "active" });
    const ids = test.sections.flatMap((s) => s.questionIds);
    const now = new Date();
    const a = await Attempt.create({
      userId: user._id, testId: test._id, kind: "placement", status: "submitted", startedAt: now, sectionStartedAt: now, finishedAt: now, scoreEst: 400,
      sectionScores: [{ section: "listening", raw: 1, total: 1, scaled: 40 }],
      answers: ids.slice(0, 5).map((q, i) => ({ qid: q, choice: i % 2, firstChoice: 0, changes: 0, timeSpentSec: 20 })),
    });
    const r = await attemptResult((await Attempt.findById(a._id))!, test as never);
    const json = JSON.stringify(r);
    expect(Object.keys(r)).not.toContain("review");
    expect(Object.keys(r)).not.toContain("transcripts");
    expect(r.unanswered).toBeTruthy(); expect(r.insights).toBeTruthy(); expect(r.summary).toBeTruthy();
    const qs = await Question.find({ _id: { $in: ids } }).select("stem explanation options").lean();
    expect(qs.length).toBeGreaterThan(10);
    for (const q of qs) {
      expect(json).not.toContain(q.stem.slice(0, 40));
      if (q.explanation) expect(json).not.toContain(q.explanation.slice(0, 40));
      for (const o of q.options ?? []) if (o.length > 12) expect(json).not.toContain(o);
    }
    expect(json).not.toMatch(/answerKey|yourChoice|"explanation"|"stem"/);

    // Quiz unit dan ujian per bagian: dilaporkan sebagai persen benar, tanpa skor EPTA, level, padanan, atau pembanding dengan tes EPTA.
    const raw = 3, total = 5;
    const q = await Attempt.create({
      userId: user._id, testId: test._id, kind: "quiz", status: "submitted", startedAt: now, sectionStartedAt: now, finishedAt: new Date(+now + 1000), scoreEst: 380,
      sectionScores: [{ section: "structure", raw, total, scaled: 40 }], answers: ids.slice(0, 3).map((id) => ({ qid: id, choice: 0, firstChoice: 0, changes: 0, timeSpentSec: 10 })),
    });
    const pr = await attemptResult((await Attempt.findById(q._id))!, test as never);
    expect(pr).toMatchObject({ partial: true, percent: 60, passScore: 70, passed: false, equivalents: null, previous: null, level: null });
    expect(pr.summary.level.next).toBeNull();
    expect(pr.summary.stats.total.scaled).toBeNull();
    expect(r.partial).toBe(false);
  }, 240_000);
});
