import { describe, it, expect, afterAll } from "vitest";

// Cakupan data analisis: placement memakai hanya percobaan itu; jenis tes lain tetap kumulatif. MongoDB in-memory, tidak menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("analisis per placement (database in-memory)", () => {
  it("placement: angka hanya dari percobaan ini; sim: tetap kumulatif", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("analysis_scope_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Attempt, Test } = await import("@/models/Test");
    const { Analysis, TopicStat } = await import("@/models/Learning");
    const { seedTests } = await import("@/lib/seed");
    const { buildEngineInput } = await import("@/lib/analysis");
    await seedTests();
    const test = (await Test.findOne({ kind: "placement" }).lean())!;
    const user = await User.create({ email: "analisis@test.id", name: "Analisis", role: "participant", status: "active" });

    // Statistik KUMULATIF (banyak percobaan): verb-form 66 butir, skor 0.
    await TopicStat.create({ userId: user._id, skill: "grammar", topic: "verb-form", score: 0, items: 66, status: "priority" });
    await TopicStat.create({ userId: user._id, skill: "listening", topic: "detail", score: 10, items: 140, status: "priority" });

    const topicScores = [
      { skill: "grammar", topic: "verb-form", correct: 2, total: 6, score: (2 / 6) * 100 },
      { skill: "listening", topic: "detail", correct: 7, total: 14, score: 50 },
      { skill: "listening", topic: "part-b", correct: 1, total: 8, score: 12.5 }, // label bagian, bukan jenis soal
      { skill: "oce", topic: "test-01", correct: 0, total: 50, score: 0 }, // label internal percobaan lama
    ];
    const mk = async (kind: "placement" | "sim") => {
      const now = new Date();
      const a = await Attempt.create({ userId: user._id, testId: test._id, kind, status: "submitted", startedAt: now, sectionStartedAt: now, finishedAt: now, scoreEst: 450, topicScores });
      return Analysis.create({ userId: user._id, sourceKind: kind, attemptId: a._id, calculated: {} });
    };

    const placement = (await buildEngineInput((await mk("placement")).toObject() as never))!;
    const pv = placement.topics.find((t) => t.topic === "verb-form")!;
    expect(pv.items).toBe(6); // BUKAN 66
    expect(Math.round(pv.score)).toBe(33);
    expect(placement.topics.find((t) => t.topic === "detail")!.items).toBe(14); // BUKAN 140
    expect(placement.topics.some((t) => t.topic === "part-b" || t.topic === "test-01")).toBe(false);
    expect(placement.validTopics.sort()).toEqual(["detail", "verb-form"]);

    const sim = (await buildEngineInput((await mk("sim")).toObject() as never))!;
    expect(sim.topics.find((t) => t.topic === "verb-form")!.items).toBe(6); // semua jenis tes: per percobaan
    const bare = await Attempt.create({ userId: user._id, testId: test._id, kind: "sim", status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), finishedAt: new Date(), scoreEst: 400, topicScores: [] });
    const fb = (await buildEngineInput((await Analysis.create({ userId: user._id, sourceKind: "sim", attemptId: bare._id, calculated: {} })).toObject() as never))!;
    expect(fb.topics.find((t) => t.topic === "verb-form")!.items).toBe(66); // tanpa rincian topik: cadangan kumulatif
  }, 240_000);
});
