import type { Types } from "mongoose";
import { HttpError } from "./rbac";
import { ProgramCycle } from "@/models/Cycle";

/** Sesi ITP yang tertaut ke periode hanya untuk peserta institusi periode itu. Sesi tanpa periode terbuka untuk semua. */
export async function sessionsVisibleTo(user: { role: string; institutionId?: Types.ObjectId | null }) {
  if (user.role === "admin") return {};
  const mine = user.institutionId ? (await ProgramCycle.find({ institutionId: user.institutionId }).select("_id").lean()).map((c) => c._id) : [];
  return { $or: [{ programCycleId: { $exists: false } }, { programCycleId: null }, { programCycleId: { $in: mine } }] };
}

export async function assertCycleExists(id?: string | null) {
  if (id && !(await ProgramCycle.exists({ _id: id }))) throw new HttpError(400, "Program cycle not found");
}
