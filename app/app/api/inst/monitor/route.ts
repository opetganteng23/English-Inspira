import { NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { monitorRows } from "@/lib/monitor";
import { Attempt, Test } from "@/models/Test";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Monitoring & Proctoring portal institusi: hanya peserta institusi ini; skor yang belum dirilis tidak ditampilkan ke admin institusi. */
export async function GET(req: Request) {
  try {
    const { inst, full } = await instContext(req);
    const users = await User.distinct("_id", { institutionId: inst._id, role: "participant" });
    const ids = await Attempt.aggregate<{ _id: Types.ObjectId; last: Date; live: number }>([
      { $match: { userId: { $in: users }, status: { $in: ["in_progress", "submitted"] }, kind: { $in: ["placement", "sim", "simulation", "final"] } } },
      { $group: { _id: "$testId", last: { $max: "$startedAt" }, live: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } } } },
      { $sort: { last: -1 } }, { $limit: 30 },
    ]);
    const names = new Map((await Test.find({ _id: { $in: ids.map((x) => x._id) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
    const tests = ids.map((x) => ({ id: String(x._id), name: names.get(String(x._id)) ?? "-", live: x.live, last: x.last }));
    const want = new URL(req.url).searchParams.get("test") || tests[0]?.id;
    if (!want) return NextResponse.json({ tests, data: null });
    if (!isValidObjectId(want) || !tests.some((t) => t.id === want)) throw new HttpError(404, "Test not found");
    return NextResponse.json({ tests, data: await monitorRows(want, new Date(), { institutionId: String(inst._id), releasedOnly: !full }) });
  } catch (e) {
    return handleError(e);
  }
}
