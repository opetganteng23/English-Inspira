import { NextResponse } from "next/server";
import { cycleState, placementNeeded } from "@/lib/cycles";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { composeName, splitName } from "@/lib/person-name";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Level } from "@/models/Config";
import { ItpRegistration } from "@/models/Itp";
import { Asset } from "@/models/Asset";

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
      id: String(u._id), email: u.email, name: u.name ?? null, givenName: u.givenName ?? splitName(u.name).givenName, surname: u.surname ?? splitName(u.name).surname, role: u.role, status: u.status, phone: u.phone ?? null,
      education: u.education ?? null, targetScore: u.targetScore ?? null, goal: u.goal ?? null,
      institutionId: u.institutionId ? String(u.institutionId) : null, institution: inst ? { name: inst.name, contractEnd: inst.contractEnd ?? null } : null,
      consentAt: u.consentAt ?? null, createdAt: u.createdAt, nameLocked, hasPassword,
      emailPrefs: { reminders: u.emailPrefs?.reminders !== false, progress: u.emailPrefs?.progress !== false }, avatarAssetId: u.avatarAssetId ? String(u.avatarAssetId) : null,
      needsConsent: u.status === "invited",
      level: level ? { id: String(level._id), name: level.name } : null, scoreEst: u.currentScoreEst ?? null,
      needsPlacement: u.role === "participant" && placementNeeded(u, await cycleState(u.institutionId)),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({
  givenName: z.string().trim().min(1).max(60).optional(),
  surname: z.string().trim().min(1).max(60).optional(),
  emailPrefs: z.object({ reminders: z.boolean().optional(), progress: z.boolean().optional() }).optional(),
  avatarAssetId: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional(),
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
    const cur = splitName(u.name);
    const given = b.givenName ?? u.givenName ?? cur.givenName, sur = b.surname ?? u.surname ?? cur.surname;
    const nameChanged = (b.givenName !== undefined || b.surname !== undefined) && composeName(given, sur) !== (u.name ?? "");
    if (nameChanged && (await ItpRegistration.exists({ userId: u._id, status: { $ne: "cancelled" } })))
      throw new HttpError(409, "Your name is locked after registering for the official ITP test");
    const rest: Partial<typeof b> = { ...b };
    delete rest.givenName; delete rest.surname; delete rest.emailPrefs; delete rest.avatarAssetId;
    u.set(rest);
    if (b.emailPrefs) u.set({ emailPrefs: { reminders: b.emailPrefs.reminders ?? u.emailPrefs?.reminders ?? true, progress: b.emailPrefs.progress ?? u.emailPrefs?.progress ?? true } });
    if (b.avatarAssetId !== undefined) {
      // Foto profil: berkas milik pengguna sendiri (aset sensitif, hanya pemilik dan admin yang bisa membuka). Foto lama dihapus.
      const old = u.avatarAssetId ? String(u.avatarAssetId) : null;
      if (b.avatarAssetId) {
        const a = await Asset.findOne({ _id: b.avatarAssetId, ownerId: u._id, sensitive: true }).select("_id").lean();
        if (!a) throw new HttpError(400, "That image was not uploaded by you");
        u.avatarAssetId = a._id;
      } else u.avatarAssetId = undefined;
      if (old && old !== b.avatarAssetId) await Asset.deleteOne({ _id: old, ownerId: u._id });
    }
    if (nameChanged) u.set({ givenName: given, surname: sur, name: composeName(given, sur) });
    await u.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
