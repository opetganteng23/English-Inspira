import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { userPatchInput, userActionInput, deleteInput } from "@/lib/admin-schemas";
import { sendResetLink, setTemporaryPassword, updateAccountIdentity, deleteInternalAccount } from "@/lib/account-admin";
import { issueInvitation } from "@/lib/participants";
import { Institution } from "@/models/Institution";
import { disableMember, enableMember } from "@/lib/participants";
import { User } from "@/models/User";
import { Enrollment } from "@/models/Access";

const CENTRAL_ROLES = ["admin", "academic_admin", "content_editor"];

/** Ubah nama / aktifkan-nonaktifkan akun internal. Menonaktifkan tidak menghapus riwayat (MTS §8). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "User not found");
    const b = userPatchInput.parse(await req.json());
    await connectDB();
    const u = await User.findById(params.id);
    if (!u) throw new HttpError(404, "User not found");

    if (b.status === "disabled" && u.role === "admin") {
      if (String(u._id) === String(admin._id)) throw new HttpError(409, "You cannot deactivate your own account");
      if ((await User.countDocuments({ role: "admin", status: { $ne: "disabled" }, _id: { $ne: u._id } })) === 0) throw new HttpError(409, "There must be at least one active admin");
    }
    if (b.name !== undefined || b.givenName !== undefined || b.surname !== undefined || b.email !== undefined || b.phone !== undefined)
      await updateAccountIdentity(u._id, { name: b.name, givenName: b.givenName, surname: b.surname, email: b.email, phone: b.phone }, admin._id);
    // Ubah peran / institusi akun internal (bukan peserta).
    if ((b.role && b.role !== u.role) || (b.institutionId !== undefined && String(b.institutionId ?? "") !== String(u.institutionId ?? ""))) {
      if (u.role === "participant") throw new HttpError(409, "Participants are managed in the Participants menu");
      const role = b.role ?? u.role;
      if (u.role === "admin" && role !== "admin") {
        if (String(u._id) === String(admin._id)) throw new HttpError(409, "You cannot remove your own admin role");
        if ((await User.countDocuments({ role: "admin", status: { $ne: "disabled" }, _id: { $ne: u._id } })) === 0) throw new HttpError(409, "There must be at least one active admin");
      }
      let institutionId: string | null = CENTRAL_ROLES.includes(role) ? null : (b.institutionId !== undefined ? b.institutionId : u.institutionId ? String(u.institutionId) : null);
      if (!CENTRAL_ROLES.includes(role)) {
        if (!institutionId) throw new HttpError(400, "Coaches and institution admins must be linked to an institution");
        const inst = await Institution.findById(institutionId).lean();
        if (!inst) throw new HttpError(404, "Institution not found");
        // Peran institusi wajib punya enrollment aktif di institusinya (akses mengikuti kontrak).
        const enr = await Enrollment.findOne({ userId: u._id, institutionId: inst._id }).lean();
        if (!enr) await Enrollment.create({ userId: u._id, institutionId: inst._id, startsAt: new Date(), expiresAt: inst.contractEnd });
        else if (enr.status !== "active") await Enrollment.updateOne({ _id: enr._id }, { status: "active", expiresAt: inst.contractEnd });
        institutionId = String(inst._id);
      }
      const from = { role: u.role, institutionId: u.institutionId ? String(u.institutionId) : null };
      await User.updateOne({ _id: u._id }, institutionId ? { $set: { role, institutionId } } : { $set: { role }, $unset: { institutionId: "" } });
      await audit(admin._id, "user.role_change", params.id, { from, to: { role, institutionId } });
    }
    if (b.status === "disabled") await disableMember(u._id);
    if (b.status === "active" && u.status === "disabled") await enableMember(u._id);
    await audit(admin._id, "user.update", params.id, b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

const origin = (req: Request) => process.env.APP_URL ?? new URL(req.url).origin;

async function internalUser(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "User not found");
  await connectDB();
  const u = await User.findOne({ _id: id, role: { $in: ["admin", "academic_admin", "content_editor", "inst_admin", "coach"] }, deletedAt: { $exists: false } });
  if (!u) throw new HttpError(404, "User not found");
  return u;
}

/** Aksi atas akun internal: kirim tautan reset, password sementara (sekali tampil), kirim ulang undangan. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const u = await internalUser(params.id);
    const b = userActionInput.parse(await req.json());
    if (b.action === "reset_link") return NextResponse.json({ ok: true, ...(await sendResetLink(u._id, origin(req), admin._id)) });
    if (b.action === "temp_password") return NextResponse.json({ ok: true, ...(await setTemporaryPassword(u._id, admin._id)) });
    if (u.status !== "invited") throw new HttpError(409, "The user is already active");
    const inst = u.institutionId ? await Institution.findById(u.institutionId) : null;
    if (!inst) throw new HttpError(409, "Institution not found");
    await issueInvitation(u, inst, admin._id);
    await audit(admin._id, "invitation.resend", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus akun internal (anonimkan data pribadi; riwayat tetap). Wajib beralasan; tidak bisa menghapus diri sendiri atau admin terakhir. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const u = await internalUser(params.id);
    const { reason } = deleteInput.parse(await req.json().catch(() => ({})));
    await deleteInternalAccount(u._id, admin._id, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
