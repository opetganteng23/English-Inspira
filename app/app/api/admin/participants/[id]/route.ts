import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { disableMember, enableMember, issueInvitation } from "@/lib/participants";
import { getLevels } from "@/lib/config";
import { eraseUserData } from "@/lib/erase";
import { splitName } from "@/lib/person-name";
import { sendResetLink, setTemporaryPassword, updateAccountIdentity } from "@/lib/account-admin";
import { User } from "@/models/User";
import { Attempt } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";
import { Institution } from "@/models/Institution";
import { Enrollment } from "@/models/Access";
import { CoachingQuota } from "@/models/Config";
import { releaseOrgHeld } from "@/lib/attempt-release";
import { voidAttempt, isVoidable } from "@/lib/attempt-void";

export const dynamic = "force-dynamic";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Participant not found");
  await connectDB();
  const u = await User.findOne({ _id: id, role: "participant" });
  if (!u) throw new HttpError(404, "Participant not found");
  return u;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const u = await find(params.id);
    const [attempts, notes, inst, enr, quotas, levels] = await Promise.all([
      Attempt.find({ userId: u._id, status: "submitted" }).sort({ finishedAt: -1 }).limit(30).select("kind scoreEst sectionScores finishedAt proctorFlags heldByOrg releasedAt releaseAt status").lean(),
      AuditLog.find({ target: params.id, action: "participant.note" }).sort({ at: -1 }).limit(30).lean(),
      u.institutionId ? Institution.findById(u.institutionId).select("name contractEnd").lean() : null,
      Enrollment.findOne({ userId: u._id }).sort({ createdAt: -1 }).lean(),
      CoachingQuota.find({ userId: u._id }).sort({ createdAt: -1 }).lean(),
      getLevels(),
    ]);
    const lv = new Map(levels.map((l) => [String(l._id), l.name]));
    await audit(admin._id, "participant.view", params.id);
    return NextResponse.json({
      profile: { id: String(u._id), name: u.name, givenName: u.givenName ?? splitName(u.name).givenName, surname: u.surname ?? splitName(u.name).surname, email: u.email, phone: u.phone, status: u.status, institution: inst?.name ?? null, consentAt: u.consentAt ?? null, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt,
        level: u.currentLevelId ? lv.get(String(u.currentLevelId)) ?? null : null, scoreEst: u.currentScoreEst ?? null, placementDone: !!u.placementAttemptId, placementRetakeAllowed: u.placementRetakeAllowed, qaTester: !!u.qaTester },
      enrollment: enr ? { status: enr.status, startsAt: enr.startsAt, expiresAt: enr.expiresAt ?? null } : null,
      quotas: quotas.map((q) => ({ level: lv.get(String(q.levelId)) ?? "-", used: q.used, total: q.total, active: q.active })),
      attempts: attempts.map((a) => ({ id: String(a._id), kind: a.kind, scoreEst: a.scoreEst, sections: a.sectionScores, finishedAt: a.finishedAt, flags: a.proctorFlags.length, held: !!a.heldByOrg && !a.releasedAt, voidable: isVoidable(a) })),
      notes: notes.map((n) => ({ text: (n.meta as { text?: string })?.text ?? "", at: n.at })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), text: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("allow_placement_retake"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("resend_invitation") }),
  z.object({ action: z.literal("activate"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("erase"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("update_profile"), givenName: z.string().trim().min(1).max(60).optional(), surname: z.string().trim().max(60).optional(), email: z.email().max(200).optional(), phone: z.string().trim().regex(/^$|^[0-9+\-\s]{8,20}$/, "Invalid phone number").optional() }),
  z.object({ action: z.literal("reset_link") }),
  z.object({ action: z.literal("temp_password") }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("release_results") }),
  z.object({ action: z.literal("void_attempt"), attemptId: z.string().regex(/^[0-9a-f]{24}$/), reason: z.string().trim().min(5, "Enter a reason (at least 5 characters)").max(300) }),
  z.object({ action: z.literal("qa_on") }),
  z.object({ action: z.literal("qa_off") }),
  z.object({ action: z.literal("extend_enrollment"), days: z.number().int().min(1).max(730), reason: z.string().trim().min(3).max(300) }),
]);

/** Aksi admin atas satu peserta. Aksi sensitif wajib beralasan dan masuk audit log. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const u = await find(params.id);
    const b = actions.parse(await req.json());
    switch (b.action) {
      case "note": await audit(admin._id, "participant.note", params.id, { text: b.text }); break;
      case "allow_placement_retake":
        if (!u.placementAttemptId) throw new HttpError(409, "The participant has not taken the placement test");
        u.placementRetakeAllowed = true; await u.save(); await audit(admin._id, "placement.retake_allowed", params.id, { reason: b.reason }); break;
      case "resend_invitation": {
        if (u.status !== "invited") throw new HttpError(409, "The participant is already active");
        const inst = await Institution.findById(u.institutionId);
        if (!inst) throw new HttpError(409, "Institution not found");
        await issueInvitation(u, inst, admin._id); await audit(admin._id, "invitation.resend", params.id); break;
      }
      case "activate":
        // Aktivasi oleh admin: persetujuan data dikumpulkan di luar aplikasi (mis. formulir kertas); dasarnya wajib dicatat.
        if (u.status !== "invited") throw new HttpError(409, "The participant is already active");
        u.status = "active"; u.consentAt ??= new Date(); await u.save();
        await audit(admin._id, "participant.activate", params.id, { reason: b.reason }); break;
      case "void_attempt": { const r = await voidAttempt(b.attemptId, String(u._id), admin._id, b.reason); return NextResponse.json({ ok: true, ...r }); }
      case "release_results": { const n = await releaseOrgHeld({ userId: u._id }); await audit(admin._id, "participant.release_results", params.id, { released: n }); break; }
      case "erase": await eraseUserData(u._id, admin._id, b.reason); break;
      case "update_profile": await updateAccountIdentity(u._id, { givenName: b.givenName, surname: b.surname, email: b.email, phone: b.phone }, admin._id); break;
      case "reset_link": return NextResponse.json({ ok: true, ...(await sendResetLink(u._id, process.env.APP_URL ?? new URL(req.url).origin, admin._id)) });
      case "temp_password": return NextResponse.json({ ok: true, ...(await setTemporaryPassword(u._id, admin._id)) });
      case "disable": await disableMember(u._id); await audit(admin._id, "participant.disable", params.id); break;
      case "enable": await enableMember(u._id); await audit(admin._id, "participant.enable", params.id); break;
      case "qa_on": case "qa_off": {
        if (u.role !== "participant") throw new HttpError(409, "Only participant accounts can be QA testers");
        u.qaTester = b.action === "qa_on"; await u.save();
        await audit(admin._id, b.action === "qa_on" ? "participant.qa_on" : "participant.qa_off", params.id); break;
      }
      case "extend_enrollment": {
        const e = await Enrollment.findOne({ userId: u._id }).sort({ createdAt: -1 });
        if (!e) throw new HttpError(404, "Enrollment not found");
        const base = e.expiresAt && e.expiresAt > new Date() ? e.expiresAt : new Date();
        e.expiresAt = new Date(+base + b.days * 86_400_000); e.status = "active"; await e.save();
        await audit(admin._id, "enrollment.extend", params.id, { days: b.days, reason: b.reason }); break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
