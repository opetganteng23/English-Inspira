import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { assignClass } from "@/lib/clustering";
import { moveInput } from "@/lib/class-schemas";
import { ClassMember } from "@/models/Cluster";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Peserta yang menunggu kelas (sudah punya level, belum di kelas aktif). */
export async function GET(req: Request) {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const level = new URL(req.url).searchParams.get("level");
    const placed = await ClassMember.distinct("userId", { active: true });
    const list = await User.find({ role: "participant", status: "active", deletedAt: { $exists: false }, currentLevelId: level && /^[0-9a-f]{24}$/.test(level) ? level : { $exists: true, $ne: null }, _id: { $nin: placed } })
      .select("name email currentScoreEst currentLevelId placementSource").sort({ currentScoreEst: -1 }).limit(500).lean();
    return NextResponse.json({ waiting: list.map((u) => ({ id: String(u._id), name: u.name ?? u.email, email: u.email, score: u.currentScoreEst ?? null, levelId: String(u.currentLevelId), source: u.placementSource ?? null })) });
  } catch (e) {
    return handleError(e);
  }
}

/** Pindah manual ({userId, classId}; classId null = keluarkan dari kelas) atau bagikan otomatis semua yang menunggu ({action:"auto"}). */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const body = await req.json();
    await connectDB();
    if (body?.action === "auto") {
      const placed = await ClassMember.distinct("userId", { active: true });
      const list = await User.find({ role: "participant", status: "active", deletedAt: { $exists: false }, currentLevelId: { $exists: true, $ne: null }, _id: { $nin: placed } }).select("_id").limit(2000).lean();
      let assigned = 0;
      for (const u of list) if (await assignClass(String(u._id), admin._id, "auto")) assigned++;
      return NextResponse.json({ assigned, stillWaiting: list.length - assigned });
    }
    const b = moveInput.parse(body);
    if (!(await User.exists({ _id: b.userId, role: "participant" }))) throw new HttpError(404, "Participant not found");
    const to = await assignClass(b.userId, admin._id, "manual", b.classId);
    return NextResponse.json({ ok: true, classId: to });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
