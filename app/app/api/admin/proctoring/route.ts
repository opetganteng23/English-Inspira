import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { Attempt, Test } from "@/models/Test";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Attempt dengan catatan proctoring ringan (tab, fullscreen, paste). Default: yang belum ditinjau. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const filter = new URL(req.url).searchParams.get("filter") ?? "pending";
    const q: Record<string, unknown> = { status: "submitted", "proctorFlags.0": { $exists: true } };
    if (filter === "pending") q["proctorReview.status"] = { $exists: false };
    const list = await Attempt.find(q).sort({ finishedAt: -1 }).limit(100).select("userId testId kind finishedAt proctorFlags proctorReview scoreEst").lean();
    const [users, tests] = await Promise.all([User.find({ _id: { $in: list.map((a) => a.userId) } }).select("name email").lean(), Test.find({ _id: { $in: list.map((a) => a.testId) } }).select("name").lean()]);
    const un = new Map(users.map((u) => [String(u._id), u])), tn = new Map(tests.map((t) => [String(t._id), t.name]));
    return NextResponse.json({
      attempts: list.map((a) => {
        const counts: Record<string, number> = {};
        for (const f of a.proctorFlags) counts[f.kind ?? "?"] = (counts[f.kind ?? "?"] ?? 0) + 1;
        return { id: String(a._id), user: un.get(String(a.userId))?.name ?? un.get(String(a.userId))?.email ?? "-", test: tn.get(String(a.testId)) ?? "-", kind: a.kind, finishedAt: a.finishedAt, scoreEst: a.scoreEst, flags: a.proctorFlags.length, counts, review: a.proctorReview?.status ? { status: a.proctorReview.status, note: a.proctorReview.note } : null };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = z.object({ id: z.string(), status: z.enum(["clean", "suspicious", "invalid"]), note: z.string().max(500).optional() }).parse(await req.json());
    if (!isValidObjectId(b.id)) throw new HttpError(404, "Attempt tidak ditemukan");
    await connectDB();
    const r = await Attempt.updateOne({ _id: b.id, status: "submitted" }, { proctorReview: { status: b.status, note: b.note, at: new Date(), by: admin._id } });
    if (!r.matchedCount) throw new HttpError(404, "Attempt tidak ditemukan");
    await audit(admin._id, "proctoring.review", b.id, { status: b.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
