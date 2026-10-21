import { Types } from "mongoose";
import { Attempt, Test } from "@/models/Test";
import { User } from "@/models/User";

/** Tes berskor (placement/simulasi/final) yang punya percobaan selesai, terbaru dulu; opsional hanya yang dikerjakan peserta satu institusi. */
export async function analyticsTests(institutionId?: string) {
  const match: Record<string, unknown> = { status: "submitted", kind: { $in: ["placement", "sim", "simulation", "final"] } };
  if (institutionId) match.userId = { $in: await User.distinct("_id", { institutionId: new Types.ObjectId(institutionId), role: "participant" }) };
  const ids = await Attempt.aggregate<{ _id: Types.ObjectId; last: Date; n: number }>([{ $match: match }, { $group: { _id: "$testId", last: { $max: "$finishedAt" }, n: { $sum: 1 } } }, { $sort: { last: -1 } }, { $limit: 30 }]);
  const names = new Map((await Test.find({ _id: { $in: ids.map((x) => x._id) } }).select("name").lean()).map((t) => [String(t._id), t.name]));
  return ids.map((x) => ({ id: String(x._id), name: names.get(String(x._id)) ?? "-", finished: x.n }));
}
