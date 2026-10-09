import type { HydratedDocument } from "mongoose";
import { connectDB } from "./db";
import { getLevels, levelForScore } from "./config";
import { enqueueMail } from "./mailq";
import { audit } from "./audit";
import { notify } from "./notify";
import { User } from "@/models/User";
import { CoachingQuota } from "@/models/Config";
import type { AttemptDoc } from "@/models/Test";

/**
 * Setelah placement selesai (MTS §12): cocokkan skor ke level → isi level/skor user →
 * buat kuota coaching sesuai level (8/4/2) → kirim email hasil. Idempoten per attempt.
 * Pengulangan placement (diizinkan admin/coach): kuota diganti hanya bila level berubah.
 */
export async function applyPlacement(attempt: HydratedDocument<AttemptDoc>) {
  await connectDB();
  const user = await User.findById(attempt.userId);
  if (!user || attempt.scoreEst == null) return null;
  if (user.placementAttemptId && String(user.placementAttemptId) === String(attempt._id)) return null; // sudah diproses

  const levels = await getLevels();
  const level = levelForScore(levels, attempt.scoreEst);
  if (!level) return null;
  const changed = !user.currentLevelId || String(user.currentLevelId) !== String(level._id);

  user.currentLevelId = level._id;
  user.currentScoreEst = attempt.scoreEst;
  user.placementAttemptId = attempt._id;
  user.placementRetakeAllowed = false;
  if (changed) user.levelHistory.push({ levelId: level._id, at: new Date(), reason: "placement" } as never);
  await user.save();

  let quota = await CoachingQuota.findOne({ userId: user._id, active: true });
  if (user.institutionId && (!quota || changed)) {
    if (quota) await CoachingQuota.updateMany({ userId: user._id, active: true }, { active: false }); // sisa kuota lama hangus
    quota = await CoachingQuota.create({ userId: user._id, institutionId: user.institutionId, levelId: level._id, total: level.coachingQuota });
  }
  await enqueueMail(user.email, "placement_result", { score: attempt.scoreEst, level: level.name, quota: quota?.total ?? level.coachingQuota, link: `${process.env.APP_URL ?? "http://localhost:3000"}/home` });
  await notify(user._id, "placement_result", { title: `Placement result: ${level.name} level`, body: `Estimated score ${attempt.scoreEst}. Coaching quota ${quota?.total ?? level.coachingQuota} sessions.`, href: "/home" }, String(attempt._id));
  await audit(user._id, "placement.applied", String(attempt._id), { level: level.key, score: attempt.scoreEst });
  return { level, quota };
}
