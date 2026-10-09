import { connectDB } from "./db";
import { Certificate } from "@/models/Itp";
import { Attempt, Test } from "@/models/Test";
import { nextSeq } from "@/models/Settings";
import type { Types } from "mongoose";

/** Skor total ITP dari 3 skor section (skala 31-68): rata-rata x 10, dibatasi 310-677. */
export const itpTotal = (l: number, s: number, r: number) => Math.min(677, Math.max(310, Math.round(((l + s + r) / 3) * 10)));
export const validSectionScore = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 31 && n <= 68;

export async function certificateNumber(type: "itp" | "sim_report") {
  const y = new Date().getFullYear();
  const seq = await nextSeq(`cert-${type}-${y}`);
  return type === "itp" ? `EPTA-ITP-${y}-${String(seq).padStart(4, "0")}` : `EPTA-RPT-${y}-${String(seq).padStart(6, "0")}`;
}

/** Terbitkan/ perbarui sertifikat ITP resmi. Idempoten per registrasi. */
export async function issueItpCertificate(reg: { _id: Types.ObjectId; userId: Types.ObjectId; fullName: string; sessionId: Types.ObjectId }, score: { listening: number; structure: number; reading: number; total: number }, sessionDate: Date) {
  await connectDB();
  const data = { name: reg.fullName, scores: score, testDate: sessionDate };
  const existing = await Certificate.findOne({ registrationId: reg._id });
  if (existing) { existing.data = data; await existing.save(); return existing; }
  return Certificate.create({ userId: reg.userId, type: "itp", number: await certificateNumber("itp"), data, registrationId: reg._id });
}

/** Laporan hasil tes simulasi (bukan sertifikat resmi). Idempoten per attempt. */
export async function ensureSimReport(attemptId: Types.ObjectId | string) {
  await connectDB();
  const a = await Attempt.findById(attemptId).lean();
  if (!a || a.status !== "submitted" || a.kind === "trial") return null;
  const hit = await Certificate.findOne({ attemptId: a._id });
  if (hit) return hit;
  const test = await Test.findById(a.testId).select("name").lean();
  const sc = (n: string) => a.sectionScores.find((s) => s.section === n)?.scaled ?? null;
  try {
    return await Certificate.create({
      userId: a.userId, type: "sim_report", number: await certificateNumber("sim_report"), attemptId: a._id,
      data: { testName: test?.name, scores: { listening: sc("listening"), structure: sc("structure"), reading: sc("reading"), total: a.scoreEst }, finishedAt: a.finishedAt },
    });
  } catch { return Certificate.findOne({ attemptId: a._id }); } // balapan: sudah dibuat proses lain
}
