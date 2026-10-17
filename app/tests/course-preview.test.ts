import { describe, it, expect, afterAll } from "vitest";
import { isPreviewer } from "@/lib/course-access";

describe("pemeriksa course", () => {
  it("hanya admin dan QA tester yang boleh melihat course mode preview", () => {
    expect(isPreviewer({ role: "admin" })).toBe(true);
    expect(isPreviewer({ role: "participant", qaTester: true })).toBe(true);
    expect(isPreviewer({ role: "participant" })).toBe(false);
    expect(isPreviewer({ role: "coach" })).toBe(false);
  });
});

// MongoDB in-memory; tidak menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;
let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

describe.skipIf(!safe)("course mode preview (database in-memory)", () => {
  it("peserta tidak melihat course dan materi yang belum dirilis; QA tester bisa mengujinya", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("course_preview_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { Types } = await import("mongoose");
    const { Course, Unit, UnitProgress } = await import("@/models/Course");
    const { Material } = await import("@/models/Material");
    const { User } = await import("@/models/User");
    const { LIVE, PREVIEW_VISIBLE, previewOnlyMaterialIds } = await import("@/lib/course-access");
    const { markMaterialDone } = await import("@/lib/units");

    const basic = new Types.ObjectId(), inter = new Types.ObjectId();
    const mk = (n: string) => Material.create({ title: n, slug: n, kind: "rich", status: "published", contentHtml: "<p>x</p>" });
    const [m1, m2, m3] = await Promise.all([mk("only-preview"), mk("shared"), mk("only-live")]);
    const live = await Course.create({ levelId: basic, title: "Live basic", active: true });
    const prev = await Course.create({ levelId: inter, title: "Preview intermediate", active: true, previewMode: true });
    const off = await Course.create({ levelId: basic, title: "Inactive", active: false });
    const archived = await Course.create({ levelId: basic, title: "Archived", active: true, archived: true, previewMode: true });
    await Unit.create({ courseId: live._id, title: "L1", materialIds: [m2._id, m3._id] });
    const pu = await Unit.create({ courseId: prev._id, title: "P1", materialIds: [m1._id, m2._id] });
    await Unit.create({ courseId: archived._id, title: "A1", materialIds: [m3._id] });

    // Peserta hanya melihat course tayang; pemeriksa melihat yang tayang dan mode preview (bukan arsip, bukan nonaktif tanpa preview).
    expect((await Course.find(LIVE).lean()).map((c) => c.title)).toEqual(["Live basic"]);
    expect((await Course.find({ ...PREVIEW_VISIBLE }).lean()).map((c) => c.title).sort()).toEqual(["Live basic", "Preview intermediate"]);
    expect(off.active).toBe(false);

    // Materi yang hanya dipakai course preview disembunyikan; materi yang juga dipakai course tayang tetap terlihat.
    const hidden = (await previewOnlyMaterialIds()).map(String);
    expect(hidden).toEqual([String(m1._id)]);

    // Progres: peserta level biasa tidak mencatat progres di course preview; QA tester mencatat (tanpa level dan prasyarat).
    const participant = await User.create({ email: "peserta@airnav.co.id", role: "participant", status: "active", currentLevelId: inter });
    await markMaterialDone(participant, m1._id);
    expect(await UnitProgress.countDocuments({ userId: participant._id, unitId: pu._id })).toBe(0);
    const qa = await User.create({ email: "qa@test.id", role: "participant", status: "active", qaTester: true });
    await markMaterialDone(qa, m1._id);
    expect(await UnitProgress.countDocuments({ userId: qa._id, unitId: pu._id })).toBe(1);
  }, 240_000);
});
