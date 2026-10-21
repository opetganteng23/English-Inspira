import { NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { monitorRows } from "@/lib/monitor";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Monitoring & Proctoring: daftar tes yang punya percobaan, dan baris percobaan untuk tes terpilih (bawaan: tes yang terakhir dikerjakan). */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const ids = await Attempt.aggregate<{ _id: Types.ObjectId; last: Date; live: number }>([
      { $match: { status: { $in: ["in_progress", "submitted"] }, kind: { $in: ["placement", "sim", "simulation", "final"] } } },
      { $group: { _id: "$testId", last: { $max: "$startedAt" }, live: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } } } },
      { $sort: { last: -1 } }, { $limit: 30 },
    ]);
    const names = new Map((await Test.find({ _id: { $in: ids.map((x) => x._id) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const tests = ids.map((x) => ({ id: String(x._id), name: names.get(String(x._id)) ?? "-", live: x.live, last: x.last }));
    const want = new URL(req.url).searchParams.get("test") || tests[0]?.id;
    if (!want) return NextResponse.json({ tests, data: null });
    if (!isValidObjectId(want)) throw new HttpError(404, "Test not found");
    const data = await monitorRows(want);
    if (!data) throw new HttpError(404, "Test not found");
    return NextResponse.json({ tests, data });
  } catch (e) {
    return handleError(e);
  }
}
