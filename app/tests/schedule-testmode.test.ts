import { describe, it, expect, afterAll } from "vitest";

// Tes yang masih berstatus Test mode: undangan dan email jadwal hanya untuk akun QA tester. MongoDB in-memory.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("pengaman email pada tes berstatus Test mode (database in-memory)", () => {
  it("peserta asli tidak menerima undangan selama Test mode; setelah dimatikan, mereka menerimanya", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("schedule_testmode");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Test } = await import("@/models/Test");
    const { MailJob } = await import("@/models/Access");
    const { TestSession, TestSeat } = await import("@/models/Schedule");
    const A = await import("@/lib/schedule-admin");
    const { seedTests } = await import("@/lib/seed");
    await seedTests();
    const test = (await Test.findOne({ kind: "placement" }).lean())!;
    const tid = String(test._id);
    const H = 3_600_000;
    const qa = await User.create({ email: "qa@test.id", name: "QA", role: "participant", status: "active", qaTester: true });
    const real1 = await User.create({ email: "asli1@airnav.co.id", name: "Asli 1", role: "participant", status: "active" });
    const real2 = await User.create({ email: "asli2@airnav.co.id", name: "Asli 2", role: "participant", status: "active" });
    const admin = await User.create({ email: "adm@test.id", name: "Adm", role: "admin", status: "active" });
    const s = await TestSession.create({ testId: test._id, label: "S1", opensAt: new Date(Date.now() + 48 * H), closesAt: new Date(Date.now() + 51 * H), capacity: 10 });
    await A.moveSeats(tid, [String(qa._id), String(real1._id), String(real2._id)], String(s._id));

    await Test.updateOne({ _id: test._id }, { testMode: true, scheduled: true });
    expect(await A.pendingInvites(tid)).toEqual({ invite: 1, reschedule: 0, skipped: 2 });
    expect(await A.sendInvites(tid)).toEqual({ invited: 1, rescheduled: 0, skipped: 2 });
    const mails = await MailJob.find({ template: "test_invitation" }).lean();
    expect(mails.map((m) => m.to)).toEqual(["qa@test.id"]);

    // Jadwal ulang peserta asli selama Test mode: tersimpan, tetapi tidak ada email.
    await TestSeat.updateOne({ testId: test._id, userId: real1._id }, { invitedAt: new Date(), invitedOpensAt: s.opensAt, invitedClosesAt: s.closesAt });
    await A.extendSeat(tid, String(real1._id), { opensAt: new Date(Date.now() + 70 * H), closesAt: new Date(Date.now() + 73 * H) }, "uji", String(admin._id));
    expect(await MailJob.countDocuments({ template: "test_reschedule" })).toBe(0);

    // Pengingat: tidak untuk peserta asli selama Test mode (tes belum Active, jadi dinyalakan dulu agar pengingat dievaluasi).
    await Test.updateOne({ _id: test._id }, { active: true });
    await TestSession.updateOne({ _id: s._id }, { opensAt: new Date(Date.now() + 10 * H), closesAt: new Date(Date.now() + 13 * H) });
    await TestSeat.updateOne({ testId: test._id, userId: qa._id }, { $unset: { remindedOpenAt: "" } });
    const r = await A.sendTestReminders();
    expect(r.opening).toBe(1);
    expect(await MailJob.countDocuments({ template: "test_reminder", to: { $in: ["asli1@airnav.co.id", "asli2@airnav.co.id"] } })).toBe(0);

    // Test mode dimatikan: peserta asli (real2 belum pernah diundang) kini menerima undangan.
    await Test.updateOne({ _id: test._id }, { testMode: false });
    expect((await A.pendingInvites(tid)).skipped).toBe(0);
    const sent = await A.sendInvites(tid);
    expect(sent.invited).toBe(1);
    expect(await MailJob.countDocuments({ template: "test_invitation", to: "asli2@airnav.co.id" })).toBe(1);
  }, 240_000);
});
