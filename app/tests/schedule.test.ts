import { describe, it, expect, afterAll } from "vitest";
import { scheduleGate, spread, windowState, effectiveWindow, pickGated } from "@/lib/schedule";

const H = 3_600_000;
const T0 = new Date("2026-10-24T09:00:00+07:00");
const win = { opensAt: T0, closesAt: new Date(+T0 + 3 * H) };

describe("aturan akses tes terjadwal", () => {
  const participant = { role: "participant" };
  it("tes tidak terjadwal, admin, dan QA tester tidak dibatasi", () => {
    expect(scheduleGate({ scheduled: false }, participant, null)).toMatchObject({ visible: true, ok: true });
    expect(scheduleGate({ scheduled: true }, { role: "admin" }, null)).toMatchObject({ visible: true, ok: true });
    expect(scheduleGate({ scheduled: true }, { role: "participant", qaTester: true }, null)).toMatchObject({ visible: true, ok: true });
  });
  it("tanpa kursi: tidak terlihat sama sekali", () => {
    expect(scheduleGate({ scheduled: true }, participant, null)).toMatchObject({ visible: false, ok: false });
  });
  it("dengan kursi: belum dibuka, terbuka, dan sudah ditutup (batas tepat di tepi jendela ikut terbuka)", () => {
    const seat = { window: win, label: "Slot 1" };
    expect(scheduleGate({ scheduled: true }, participant, seat, new Date(+T0 - 1))).toMatchObject({ visible: true, ok: false, state: "upcoming" });
    expect(scheduleGate({ scheduled: true }, participant, seat, T0)).toMatchObject({ ok: true, state: "open" });
    expect(scheduleGate({ scheduled: true }, participant, seat, win.closesAt)).toMatchObject({ ok: true, state: "open" });
    const closed = scheduleGate({ scheduled: true }, participant, seat, new Date(+win.closesAt + 1));
    expect(closed).toMatchObject({ visible: true, ok: false, state: "closed" });
    expect(closed.reason).toMatch(/closed/);
  });
  it("perpanjangan per peserta menggantikan jendela sesi", () => {
    const w = effectiveWindow(win, { opensAt: new Date(+T0 + 24 * H), closesAt: new Date(+T0 + 27 * H) });
    expect(windowState(w, new Date(+T0 + 1 * H))).toBe("upcoming");
    expect(windowState(w, new Date(+T0 + 25 * H))).toBe("open");
    expect(effectiveWindow(win, null)).toEqual(win);
  });
});

describe("memilih varian placement untuk peserta", () => {
  const p = { role: "participant" };
  const gate = (t: { scheduled: boolean }, seat: { window: typeof win } | null, now = new Date(+T0 + H)) => scheduleGate(t, p, seat, now);
  it("memilih varian yang dijadwalkan untuk peserta, bukan varian pertama di daftar", () => {
    const t1 = { id: "T01", scheduled: true }, t2 = { id: "T02", scheduled: true }, t3 = { id: "T03", scheduled: true };
    const seats: Record<string, { window: typeof win } | null> = { T01: null, T02: { window: win }, T03: null };
    const picked = pickGated([t1, t2, t3].map((t) => ({ test: t, gate: gate(t, seats[t.id]) })));
    expect(picked?.test.id).toBe("T02");
  });
  it("tidak ada varian untuknya: null; varian terbuka didahulukan dari yang belum buka atau sudah tutup", () => {
    const a = { id: "A", scheduled: true }, b = { id: "B", scheduled: true }, c = { id: "C", scheduled: false };
    expect(pickGated([a, b].map((t) => ({ test: t, gate: gate(t, null) })))).toBeNull();
    const later = { window: { opensAt: new Date(+T0 + 48 * H), closesAt: new Date(+T0 + 51 * H) } };
    const closed = { window: { opensAt: new Date(+T0 - 48 * H), closesAt: new Date(+T0 - 45 * H) } };
    expect(pickGated([{ test: a, gate: gate(a, closed) }, { test: b, gate: gate(b, later) }, { test: c, gate: gate(c, null) }])?.test.id).toBe("C"); // tidak terjadwal = terbuka
    expect(pickGated([{ test: a, gate: gate(a, closed) }, { test: b, gate: gate(b, later) }])?.test.id).toBe("B"); // akan dibuka lebih dulu daripada yang sudah tutup
  });
});

describe("sebar peserta ke slot", () => {
  const people = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}`, group: i < 70 ? "A" : "B" }));
  const slots = () => [{ id: "s1", capacity: 60, filled: 0 }, { id: "s2", capacity: 60, filled: 0 }];
  const count = (m: Map<string, string>, id: string) => [...m.values()].filter((v) => v === id).length;

  it("acak merata: seimbang, tak melewati kuota, hasil sama untuk seed yang sama", () => {
    const a = spread(people, slots(), "random", "x"), b = spread(people, slots(), "random", "x"), c = spread(people, slots(), "random", "y");
    expect(a.placed.size).toBe(100); expect(a.left).toEqual([]);
    expect(count(a.placed, "s1")).toBe(50); expect(count(a.placed, "s2")).toBe(50);
    expect([...a.placed]).toEqual([...b.placed]);
    expect([...a.placed]).not.toEqual([...c.placed]);
  });
  it("berurutan: slot pertama penuh dulu", () => {
    const r = spread(people, slots(), "sequential", "x");
    expect(count(r.placed, "s1")).toBe(60); expect(count(r.placed, "s2")).toBe(40);
    expect(r.placed.get("u0")).toBe("s1"); expect(r.placed.get("u99")).toBe("s2");
  });
  it("kuota habis: sisanya dilaporkan, tidak ada yang terdorong melewati kuota", () => {
    const r = spread(people, [{ id: "s1", capacity: 30, filled: 10 }, { id: "s2", capacity: 10, filled: 0 }], "random", "x");
    expect(r.placed.size).toBe(30); expect(r.left.length).toBe(70);
    expect(count(r.placed, "s1")).toBe(20); expect(count(r.placed, "s2")).toBe(10);
    expect(new Set([...r.placed.keys(), ...r.left]).size).toBe(100);
  });
  it("seimbang per kelompok: tiap slot menerima campuran proporsional", () => {
    const r = spread(people, slots(), "balanced", "x");
    const inSlot = (slot: string, g: string) => people.filter((p) => p.group === g && r.placed.get(p.id) === slot).length;
    expect(inSlot("s1", "A") + inSlot("s2", "A")).toBe(70);
    expect(Math.abs(inSlot("s1", "A") - inSlot("s2", "A"))).toBeLessThanOrEqual(1);
    expect(Math.abs(inSlot("s1", "B") - inSlot("s2", "B"))).toBeLessThanOrEqual(1);
  });
});

// Operasi admin pada MongoDB in-memory; tidak menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("jadwal tes (database in-memory)", () => {
  it("kuota, pemindahan, undangan, jadwal ulang, perpanjangan, dan pengingat", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("schedule_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Test, Attempt } = await import("@/models/Test");
    const { MailJob } = await import("@/models/Access");
    const { TestSeat, TestSession } = await import("@/models/Schedule");
    const A = await import("@/lib/schedule-admin");
    const { seatsFor } = await import("@/lib/schedule-db");
    const { seedTests } = await import("@/lib/seed");
    await seedTests();
    const test = (await Test.findOne({ kind: "sim" }).lean()) ?? (await Test.findOne().lean())!;
    const tid = String(test._id);
    const mk = (n: number) => User.create({ email: `p${n}@airnav.co.id`, name: `Peserta ${n}`, role: "participant", status: "active" });
    const users = await Promise.all(Array.from({ length: 6 }, (_, i) => mk(i)));
    const admin = await User.create({ email: "adm@test.id", name: "Adm", role: "admin", status: "active" });
    const S1 = await TestSession.create({ testId: test._id, label: "Pagi", opensAt: new Date(Date.now() + 48 * H), closesAt: new Date(Date.now() + 51 * H), capacity: 3 });
    const S2 = await TestSession.create({ testId: test._id, label: "Siang", opensAt: new Date(Date.now() + 52 * H), closesAt: new Date(Date.now() + 55 * H), capacity: 3 });

    // Kolam: semua 6 (admin tidak ikut), kecuali yang sudah menyelesaikan tes.
    await Attempt.create({ userId: users[5]._id, testId: test._id, kind: test.kind, status: "submitted", startedAt: new Date(), sectionStartedAt: new Date(), finishedAt: new Date() });
    expect((await A.eligiblePool(tid)).map((p) => p.email).sort()).toEqual(users.slice(0, 5).map((u) => u.email).sort());

    // Sebar: 5 orang ke dua slot berkuota 3+3, semua tertampung dan tidak ada yang melebihi kuota.
    const r = await A.autoSpread(tid, { mode: "random", seed: "t" });
    expect(r).toMatchObject({ placed: 5, left: 0 });
    expect(await TestSeat.countDocuments({ sessionId: S1._id })).toBeLessThanOrEqual(3);
    expect(await TestSeat.countDocuments({ testId: test._id })).toBe(5);
    expect(await A.eligiblePool(tid)).toEqual([]);

    // Pindah melebihi kuota ditolak; pindah ke slot dengan ruang berhasil.
    const s1Users = (await TestSeat.find({ sessionId: S1._id }).lean()).map((s) => String(s.userId));
    const s2Users = (await TestSeat.find({ sessionId: S2._id }).lean()).map((s) => String(s.userId));
    const full = s1Users.length === 3 ? S1 : S2, other = full === S1 ? S2 : S1;
    const fullUsers = full === S1 ? s1Users : s2Users, otherUsers = full === S1 ? s2Users : s1Users;
    await expect(A.moveSeats(tid, [otherUsers[0]], String(full._id))).rejects.toThrow(/free seats/);
    const moved = await A.moveSeats(tid, [fullUsers[0]], String(other._id));
    expect(moved.moved).toBe(1);
    expect(await TestSeat.countDocuments({ sessionId: other._id })).toBe(otherUsers.length + 1);
    // Keluarkan dari sesi mengembalikan ke kolam.
    await A.moveSeats(tid, [fullUsers[1]], null);
    expect((await A.eligiblePool(tid)).length).toBe(1);

    // Undangan: tiap kursi menerima tepat satu email; mengirim lagi tidak menggandakan.
    expect(await A.pendingInvites(tid)).toEqual({ invite: 4, reschedule: 0 });
    expect(await A.sendInvites(tid)).toEqual({ invited: 4, rescheduled: 0 });
    expect(await MailJob.countDocuments({ template: "test_invitation" })).toBe(4);
    expect(await A.sendInvites(tid)).toEqual({ invited: 0, rescheduled: 0 });

    // Perpanjangan satu peserta: hanya dia yang berubah, dan dia menerima email jadwal baru.
    const who = (await TestSeat.findOne({ testId: test._id }).lean())!;
    const newOpen = new Date(Date.now() + 100 * H), newClose = new Date(Date.now() + 103 * H);
    await A.extendSeat(tid, String(who.userId), { opensAt: newOpen, closesAt: newClose }, "Sick leave", String(admin._id));
    const seat = (await seatsFor(who.userId, [test._id])).get(tid)!;
    expect(+seat.window.opensAt).toBe(+newOpen);
    expect(await MailJob.countDocuments({ template: "test_reschedule" })).toBe(1);
    const others = (await TestSeat.find({ testId: test._id, userId: { $ne: who.userId } }).lean());
    for (const o of others) expect(o.override?.at).toBeUndefined();
    expect(await A.pendingInvites(tid)).toEqual({ invite: 0, reschedule: 0 }); // email jadwal baru sudah dikirim saat perpanjangan
    await expect(A.extendSeat(tid, String(users[5]._id), { opensAt: newOpen, closesAt: newClose }, "x y z", String(admin._id))).rejects.toThrow(/no seat/);
    await expect(A.extendSeat(tid, String(who.userId), { opensAt: newClose, closesAt: newOpen }, "bad window", String(admin._id))).rejects.toThrow(/after the opening/);

    // Memindah sesi setelah diundang menandai kebutuhan email jadwal baru.
    const mover = (await TestSeat.findOne({ testId: test._id, userId: { $ne: who.userId }, sessionId: other._id }).lean())!;
    await A.moveSeats(tid, [String(mover.userId)], String(full._id));
    expect((await A.pendingInvites(tid)).reschedule).toBe(1);

    // Pengingat H-1: hanya yang belum mulai, tepat sekali.
    await Test.updateOne({ _id: test._id }, { scheduled: true, active: true });
    const soon = new Date(Date.now() + 10 * H);
    await TestSession.updateOne({ _id: S1._id }, { opensAt: soon, closesAt: new Date(+soon + 3 * H) });
    await TestSession.updateOne({ _id: S2._id }, { opensAt: soon, closesAt: new Date(+soon + 3 * H) });
    await TestSeat.updateMany({ testId: test._id }, { $unset: { override: "" } });
    const r1 = await A.sendTestReminders();
    expect(r1.opening).toBe(4); // 4 kursi, semuanya belum mulai
    expect((await A.sendTestReminders()).opening).toBe(0); // tidak diulang
  }, 240_000);
});
