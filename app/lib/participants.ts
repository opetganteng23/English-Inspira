import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { enqueueMail } from "./mailq";
import { Institution } from "@/models/Institution";
import { User } from "@/models/User";
import { Enrollment, Invitation } from "@/models/Access";

const INVITE_DAYS = 7;
export const emailSchema = z.email().max(200);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Ambil institusi yang boleh menerima anggota baru: aktif dan kontrak belum berakhir. */
export async function activeInstitution(id: Types.ObjectId | string) {
  await connectDB();
  const inst = await Institution.findById(id);
  if (!inst) throw new HttpError(404, "Institution not found");
  if (inst.status !== "active") throw new HttpError(409, "The institution is inactive");
  if (inst.contractEnd && inst.contractEnd < new Date()) throw new HttpError(409, "The institution's contract has ended");
  return inst;
}

/** Terbitkan undangan baru (token berumur 7 hari, disimpan sebagai hash) dan antrekan emailnya. */
export async function issueInvitation(user: { _id: Types.ObjectId; email: string; name?: string | null }, institution: { _id: Types.ObjectId; name: string }, invitedBy?: Types.ObjectId | string) {
  await Invitation.updateMany({ userId: user._id, status: "pending" }, { status: "revoked" }); // undangan lama tidak berlaku lagi
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await Invitation.create({ email: user.email, userId: user._id, institutionId: institution._id, tokenHash: sha256(token), expiresAt, invitedBy });
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/sign-in?invite=${token}`;
  await enqueueMail(user.email, "invitation", { institution: institution.name, name: user.name, link, expiresAt });
}

export type MemberInput = { email: string; name?: string; phone?: string; role?: "participant" | "coach" | "inst_admin" };

/**
 * Buat akun anggota institusi: user (invited) + enrollment + undangan.
 * Kursi peserta diambil ATOMIK agar impor serentak tidak melebihi `seats`.
 * Email yang sudah ada: bila masih invited di institusi yang sama → undangan dikirim ulang; selain itu ditolak.
 */
export async function createMember(institutionId: Types.ObjectId | string, input: MemberInput, invitedBy?: Types.ObjectId | string) {
  const email = emailSchema.parse(input.email).toLowerCase().trim();
  const role = input.role ?? "participant";
  const inst = await activeInstitution(institutionId);

  const existing = await User.findOne({ email });
  if (existing) {
    if (String(existing.institutionId) !== String(inst._id)) throw new HttpError(409, "Email already registered at another institution");
    if (existing.status === "invited") { await issueInvitation(existing, inst, invitedBy); return { userId: existing._id, resent: true }; }
    throw new HttpError(409, "Email already registered and active");
  }

  if (role === "participant") {
    const seat = await Institution.findOneAndUpdate({ _id: inst._id, $expr: { $lt: ["$seatsUsed", "$seats"] } }, { $inc: { seatsUsed: 1 } });
    if (!seat) throw new HttpError(409, "The institution's seats are full");
  }
  let user;
  try {
    user = await User.create({ email, name: input.name?.trim() || undefined, phone: input.phone?.trim() || undefined, role, institutionId: inst._id, status: "invited" });
    await Enrollment.create({ userId: user._id, institutionId: inst._id, startsAt: inst.contractStart && inst.contractStart > new Date() ? inst.contractStart : new Date(), expiresAt: inst.contractEnd });
  } catch (e) {
    if (role === "participant") await Institution.updateOne({ _id: inst._id }, { $inc: { seatsUsed: -1 } }); // gagal: kembalikan kursi
    throw e;
  }
  await issueInvitation(user, inst, invitedBy);
  return { userId: user._id, resent: false };
}

/** Nonaktifkan anggota: enrollment dinonaktifkan dan kursi dikembalikan. Riwayat tidak dihapus. */
export async function disableMember(userId: Types.ObjectId | string) {
  const u = await User.findById(userId);
  if (!u) throw new HttpError(404, "User not found");
  if (u.status === "disabled") return;
  u.status = "disabled";
  await u.save();
  await Enrollment.updateMany({ userId: u._id, status: "active" }, { status: "disabled" });
  if (u.role === "participant" && u.institutionId) await Institution.updateOne({ _id: u.institutionId, seatsUsed: { $gt: 0 } }, { $inc: { seatsUsed: -1 } });
}

/** Aktifkan kembali (butuh kursi kosong untuk peserta). */
export async function enableMember(userId: Types.ObjectId | string) {
  const u = await User.findById(userId);
  if (!u) throw new HttpError(404, "User not found");
  if (u.status !== "disabled") return;
  if (u.role === "participant" && u.institutionId) {
    const seat = await Institution.findOneAndUpdate({ _id: u.institutionId, $expr: { $lt: ["$seatsUsed", "$seats"] } }, { $inc: { seatsUsed: 1 } });
    if (!seat) throw new HttpError(409, "The institution's seats are full");
  }
  u.status = u.consentAt ? "active" : "invited";
  await u.save();
  await Enrollment.updateMany({ userId: u._id, status: "disabled" }, { status: "active" });
}
