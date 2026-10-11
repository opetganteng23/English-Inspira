import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { audit } from "./audit";
import { enqueueMail } from "./mailq";
import { hashPassword } from "./password";
import { sha256 } from "./participants";
import { composeName, splitName } from "./person-name";
import { eraseUserData } from "./erase";
import { User } from "@/models/User";
import { CoachSlot, Booking } from "@/models/Coaching";

/** Kirim tautan reset password (30 menit, sekali pakai) atas permintaan admin. Berlaku untuk semua peran selama akun tidak dinonaktifkan. */
export async function sendResetLink(userId: Types.ObjectId | string, origin: string, actorId: Types.ObjectId | string) {
  await connectDB();
  const u = await User.findById(userId);
  if (!u || u.deletedAt) throw new HttpError(404, "User not found");
  if (u.status === "disabled") throw new HttpError(409, "The account is deactivated. Activate it first.");
  const token = randomBytes(32).toString("hex");
  await User.updateOne({ _id: u._id }, { resetTokenHash: sha256(token), resetExpiresAt: new Date(Date.now() + 30 * 60_000) });
  await enqueueMail(u.email, "password_reset", { link: `${origin}/reset-password?token=${token}` }, { priority: 1 });
  await audit(actorId, "user.reset_link", String(u._id));
  return { email: u.email };
}

/** Password sementara (sekali tampil) untuk kasus email tidak sampai. Password lama tidak berlaku; tautan reset yang beredar dibatalkan. */
export async function setTemporaryPassword(userId: Types.ObjectId | string, actorId: Types.ObjectId | string) {
  await connectDB();
  const u = await User.findById(userId);
  if (!u || u.deletedAt) throw new HttpError(404, "User not found");
  if (u.status === "disabled") throw new HttpError(409, "The account is deactivated. Activate it first.");
  // 12 karakter dari alfabet tanpa karakter membingungkan (0/O, 1/l/I) + angka dan simbol, mudah didiktekan.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  const pw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "-" + String(randomBytes(1)[0] % 90 + 10);
  await User.updateOne({ _id: u._id }, { passwordHash: await hashPassword(pw), emailVerifiedAt: u.emailVerifiedAt ?? new Date(), $unset: { resetTokenHash: 1, resetExpiresAt: 1 } });
  await audit(actorId, "user.temp_password", String(u._id)); // password tidak pernah dicatat
  return { email: u.email, password: pw };
}

type NameInput = { givenName?: string; surname?: string; name?: string; email?: string; phone?: string };

/** Ubah identitas akun (nama, email, telepon). Email harus unik; nama gabungan diturunkan dari given name + surname. */
export async function updateAccountIdentity(userId: Types.ObjectId | string, b: NameInput, actorId: Types.ObjectId | string) {
  await connectDB();
  const u = await User.findById(userId);
  if (!u || u.deletedAt) throw new HttpError(404, "User not found");
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (b.givenName !== undefined || b.surname !== undefined) {
    const cur = splitName(u.name);
    const given = (b.givenName ?? u.givenName ?? cur.givenName).trim(), sur = (b.surname ?? u.surname ?? cur.surname).trim();
    if (!given) throw new HttpError(400, "Given name cannot be empty");
    Object.assign(set, { givenName: given, surname: sur, name: composeName(given, sur) });
  } else if (b.name !== undefined) set.name = b.name.trim();
  if (b.phone !== undefined) { if (b.phone.trim()) set.phone = b.phone.trim(); else unset.phone = 1; }
  let emailChanged = false;
  if (b.email !== undefined) {
    const email = b.email.toLowerCase().trim();
    if (email !== u.email) {
      if (await User.exists({ email, _id: { $ne: u._id } })) throw new HttpError(409, "Email already registered");
      set.email = email; unset.emailVerifiedAt = 1; emailChanged = true;
    }
  }
  if (!Object.keys(set).length && !Object.keys(unset).length) return;
  await User.updateOne({ _id: u._id }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  await audit(actorId, "user.update_identity", String(u._id), { fields: Object.keys(set), emailChanged });
}

/** Hapus akun internal. Data pribadi dihapus/dianonimkan; riwayat (audit, materi, tes) tetap utuh agar tidak ada referensi yang putus. */
export async function deleteInternalAccount(userId: Types.ObjectId | string, actorId: Types.ObjectId | string, reason: string) {
  await connectDB();
  const u = await User.findById(userId);
  if (!u || u.deletedAt) throw new HttpError(404, "User not found");
  if (String(u._id) === String(actorId)) throw new HttpError(409, "You cannot delete your own account");

  if (u.role === "admin") {
    if ((await User.countDocuments({ role: "admin", status: { $ne: "disabled" }, deletedAt: { $exists: false }, _id: { $ne: u._id } })) === 0)
      throw new HttpError(409, "There must be at least one active admin");
    await User.updateOne({ _id: u._id }, {
      $set: { email: `deleted-${u._id}@deleted.invalid`, name: "Deleted account", status: "disabled", deletedAt: new Date() },
      $unset: { phone: 1, givenName: 1, surname: 1, passwordHash: 1, pendingPasswordHash: 1, resetTokenHash: 1, resetExpiresAt: 1 },
    });
    await audit(actorId, "user.delete", String(u._id), { role: "admin", reason });
    return;
  }
  if (u.role === "coach") {
    const slots = await CoachSlot.find({ coachId: u._id, startsAt: { $gt: new Date() }, status: { $ne: "cancelled" } }).select("_id").lean();
    if (slots.length && (await Booking.exists({ slotId: { $in: slots.map((s) => s._id) }, active: true, status: "booked" })))
      throw new HttpError(409, "This coach has upcoming booked sessions. Cancel the slots first, then delete the account.");
    await CoachSlot.updateMany({ coachId: u._id, startsAt: { $gt: new Date() }, status: "published" }, { status: "cancelled", cancelReason: "Coach account deleted" });
  }
  await eraseUserData(u._id, actorId, reason);
  await audit(actorId, "user.delete", String(u._id), { role: u.role, reason });
}

