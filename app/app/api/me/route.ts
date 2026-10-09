import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Level } from "@/models/Config";
import { ItpRegistration } from "@/models/Itp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const [inst, level] = await Promise.all([
      u.institutionId ? Institution.findById(u.institutionId).select("name contractEnd").lean() : null,
      u.currentLevelId ? Level.findById(u.currentLevelId).select("name").lean() : null,
    ]);
    const nameLocked = !!(await ItpRegistration.exists({ userId: u._id, status: { $ne: "cancelled" } }));
    const hasPassword = !!(await User.exists({ _id: u._id, passwordHash: { $exists: true } }));
    return NextResponse.json({
      id: String(u._id), email: u.email, name: u.name ?? null, role: u.role, status: u.status, phone: u.phone ?? null,
      education: u.education ?? null, targetScore: u.targetScore ?? null, goal: u.goal ?? null,
      institutionId: u.institutionId ? String(u.institutionId) : null, institution: inst ? { name: inst.name, contractEnd: inst.contractEnd ?? null } : null,
      consentAt: u.consentAt ?? null, createdAt: u.createdAt, nameLocked, hasPassword,
      needsConsent: u.status === "invited",
      level: level ? { id: String(level._id), name: level.name } : null, scoreEst: u.currentScoreEst ?? null,
      needsPlacement: u.role === "participant" && !u.placementAttemptId,
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Invalid phone number").optional(),
  education: z.enum(["sma", "d3", "s1", "s2"]).optional(),
  targetScore: z.union([z.literal(450), z.literal(500), z.literal(550), z.literal(600)]).optional(),
  goal: z.enum(["graduation", "scholarship", "career", "other"]).optional(),
});

/** Ubah profil sendiri. Level/skor/status/institusi tidak bisa diubah dari sini. */
export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Not signed in");
    if (me.status === "invited") throw new HttpError(403, "Complete the data consent first", "consent_required");
    const b = patch.parse(await req.json());
    await connectDB();
    const u = await User.findById(me._id);
    if (!u) throw new HttpError(401, "Not signed in");
    if (b.name && b.name !== u.name && (await ItpRegistration.exists({ userId: u._id, status: { $ne: "cancelled" } })))
      throw new HttpError(409, "Your name is locked after registering for the official ITP test");
    u.set(b);
    await u.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
