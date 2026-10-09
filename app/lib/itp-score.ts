import { HttpError } from "./rbac";
import { issueItpCertificate, itpTotal, validSectionScore } from "./certificates";
import { ItpRegistration, ItpSession } from "@/models/Itp";
import type { Types } from "mongoose";

/** Simpan skor resmi satu peserta, hitung total otomatis, tandai selesai, dan terbitkan sertifikat. */
export async function applyOfficialScore(regId: Types.ObjectId | string, s: { listening: number; structure: number; reading: number }) {
  for (const k of ["listening", "structure", "reading"] as const)
    if (!validSectionScore(s[k])) throw new HttpError(400, `The ${k} score must be a whole number from 31 to 68`);
  const reg = await ItpRegistration.findById(regId);
  if (!reg || reg.status === "cancelled") throw new HttpError(404, "Registration not found");
  const session = await ItpSession.findById(reg.sessionId).lean();
  const total = itpTotal(s.listening, s.structure, s.reading);
  reg.score = { ...s, total };
  reg.status = "done";
  const cert = await issueItpCertificate(reg, { ...s, total }, session?.date ?? new Date());
  reg.certificateId = cert._id;
  await reg.save();
  return { total, certificateNumber: cert.number };
}
