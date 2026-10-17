import { describe, it, expect, afterAll } from "vitest";

// Integrasi dengan MongoDB in-memory (lib/db.ts memakainya bila MONGODB_URI kosong). Tidak pernah menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;

async function waitFor(check: () => Promise<boolean>, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("penahanan hasil tes (database in-memory)", () => {
  it("efek hasil ditunda sampai waktu rilis, dilepas cron sekali saja, dan tes tanpa penahanan berjalan seperti biasa", async () => {
    // Server in-memory milik uji ini (batas start dilonggarkan untuk Windows); koneksi aplikasi diarahkan ke sana.
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("release_test");
    const { connectDB } = await import("@/lib/db");
    const { seedTests } = await import("@/lib/seed");
    const { finalize, releaseDueResults, ensureReleased } = await import("@/lib/attempts");
    const { pendingEffectsFilter } = await import("@/lib/attempt-release");
    const { User } = await import("@/models/User");
    const { Attempt, Test } = await import("@/models/Test");
    const { MailJob } = await import("@/models/Access");
    await connectDB();
    const seeded = await seedTests();
    const test = await Test.findOne({ kind: "placement" }).lean();
    expect(test).toBeTruthy();

    const mkUser = (email: string) => User.create({ email, name: email, role: "participant", status: "active" });
    const start = async (userId: import("mongoose").Types.ObjectId, releaseAt?: Date) => {
      const now = new Date();
      return Attempt.create({ userId, testId: test!._id, kind: "placement", startedAt: now, sectionStartedAt: now, ...(releaseAt ? { releaseAt } : {}) });
    };

    // 1. Hasil ditahan 2 jam: submit menyimpan hasil, tetapi level, email, dan analisis belum dijalankan.
    const held = await mkUser("ditahan@test.id");
    const a1 = await start(held._id, new Date(Date.now() + 2 * 3600_000));
    await finalize((await Attempt.findById(a1._id))!, test!);
    await new Promise((r) => setTimeout(r, 800));
    const a1s = (await Attempt.findById(a1._id).lean())!;
    expect(a1s.status).toBe("submitted");
    expect(a1s.scoreEst).toBeTypeOf("number"); // skor sudah dihitung dan disimpan, hanya tidak diperlihatkan
    const u1 = (await User.findById(held._id).lean())!;
    expect(u1.placementAttemptId).toBeFalsy();
    expect(u1.currentLevelId).toBeFalsy();
    expect(await MailJob.countDocuments({ to: "ditahan@test.id", template: "placement_result" })).toBe(0);
    expect(await releaseDueResults()).toBe(0); // belum jatuh tempo

    // 2. Waktu rilis tiba: cron menjalankan efek sekali.
    await Attempt.updateOne({ _id: a1._id }, { releaseAt: new Date(Date.now() - 1000) });
    expect(await releaseDueResults()).toBe(1);
    const u1b = (await User.findById(held._id).lean())!;
    expect(String(u1b.placementAttemptId)).toBe(String(a1._id));
    expect(u1b.currentLevelId).toBeTruthy();
    expect(await MailJob.countDocuments({ to: "ditahan@test.id", template: "placement_result" })).toBe(1);
    expect((await Attempt.findById(a1._id).lean())!.releasedAt).toBeTruthy();
    expect(await releaseDueResults()).toBe(0); // tidak diulang

    // 3. Tanpa penahanan: efek berjalan segera, dan cron tidak menyentuhnya.
    const plain = await mkUser("langsung@test.id");
    const a2 = await start(plain._id);
    await finalize((await Attempt.findById(a2._id))!, test!);
    expect(await waitFor(async () => !!(await User.findById(plain._id).lean())?.placementAttemptId)).toBe(true);
    expect(await releaseDueResults()).toBe(0);

    // 4. Submit setelah waktu rilis lewat (mis. timer): efek berjalan segera dan tidak diulang oleh cron.
    const late = await mkUser("terlambat@test.id");
    const a3 = await start(late._id, new Date(Date.now() - 1000));
    await finalize((await Attempt.findById(a3._id))!, test!);
    expect(await waitFor(async () => !!(await User.findById(late._id).lean())?.placementAttemptId)).toBe(true);
    expect(await releaseDueResults()).toBe(0);
    expect(await MailJob.countDocuments({ to: "terlambat@test.id", template: "placement_result" })).toBe(1);

    // 5. Waktu rilis lewat tetapi cron belum memproses: tetap dianggap tertunda (placement tidak boleh diulang),
    //    dan peserta yang membuka hasilnya memicu pelepasan miliknya sendiri, tanpa ganda dengan cron.
    const opener = await mkUser("buka@test.id");
    const a4 = await start(opener._id, new Date(Date.now() + 3600_000));
    await finalize((await Attempt.findById(a4._id))!, test!);
    await Attempt.updateOne({ _id: a4._id }, { releaseAt: new Date(Date.now() - 1000) });
    expect(await Attempt.exists({ _id: a4._id, ...pendingEffectsFilter })).toBeTruthy();
    await ensureReleased((await Attempt.findById(a4._id))!);
    expect(String((await User.findById(opener._id).lean())!.placementAttemptId)).toBe(String(a4._id));
    expect(await Attempt.exists({ _id: a4._id, ...pendingEffectsFilter })).toBeFalsy();
    await ensureReleased((await Attempt.findById(a4._id))!); // dipanggil lagi: tidak mengulang efek
    expect(await releaseDueResults()).toBe(0);
    expect(await MailJob.countDocuments({ to: "buka@test.id", template: "placement_result" })).toBe(1);
    expect(seeded).toBeTruthy();
  }, 240_000);

  it("releaseAtFor: admin dan QA tester dikecualikan; hanya bila ada penundaan", async () => {
    const { releaseAtFor, isReleased, exemptFromDelay } = await import("@/lib/attempt-release");
    const t0 = new Date("2026-10-17T05:00:00Z");
    expect(releaseAtFor({ resultDelayMin: 120 }, { role: "participant" }, t0)?.toISOString()).toBe("2026-10-17T07:00:00.000Z");
    expect(releaseAtFor({ resultDelayMin: 120 }, { role: "participant", qaTester: true }, t0)).toBeUndefined();
    expect(releaseAtFor({ resultDelayMin: 120 }, { role: "admin" }, t0)).toBeUndefined();
    expect(releaseAtFor({ resultDelayMin: 0 }, { role: "participant" }, t0)).toBeUndefined();
    expect(releaseAtFor({}, { role: "participant" }, t0)).toBeUndefined();
    expect(isReleased({ releaseAt: new Date(Date.now() + 1000) })).toBe(false);
    expect(isReleased({ releaseAt: new Date(Date.now() - 1000) })).toBe(true);
    expect(isReleased({})).toBe(true);
    expect(exemptFromDelay({ role: "participant" })).toBe(false);
  });

  it("placement terkunci selama hasil placement sebelumnya masih ditahan", async () => {
    const { canStartTest } = await import("@/lib/test-access");
    const user = { role: "participant", placementAttemptId: undefined, placementRetakeAllowed: false, currentLevelId: undefined } as never;
    expect(canStartTest(user, { kind: "placement" } as never, { pendingRelease: new Date() }).ok).toBe(false);
    expect(canStartTest(user, { kind: "placement" } as never, {}).ok).toBe(true);
    expect(canStartTest({ ...(user as object), qaTester: true } as never, { kind: "placement" } as never, { pendingRelease: new Date() }).ok).toBe(true);
  });
});
