import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { Test } from "@/models/Test";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pencarian global admin: peserta, staf (admin institusi, coach, admin), institusi, tes. */
export async function GET(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ participants: [], staff: [], institutions: [], tests: [] });
    await connectDB();
    const rx = new RegExp(esc(q), "i");
    const who = { $or: [{ name: rx }, { email: rx }] };
    const [participants, staff, institutions, tests] = await Promise.all([
      User.find({ role: "participant", ...who }).sort({ name: 1 }).limit(8).select("name email institutionId status").lean(),
      admin.role === "admin" ? User.find({ role: { $ne: "participant" }, ...who }).sort({ name: 1 }).limit(5).select("name email role institutionId").lean() : [],
      Institution.find({ $or: [{ name: rx }, { code: rx }] }).sort({ name: 1 }).limit(5).select("name code").lean(),
      Test.find({ name: rx }).sort({ createdAt: -1 }).limit(5).select("name kind").lean(),
    ]);
    const instIds = [...participants, ...staff].map((u) => u.institutionId).filter(Boolean) as Types.ObjectId[];
    const inst = new Map((await Institution.find({ _id: { $in: instIds } }).select("name").lean()).map((i) => [String(i._id), i.name]));
    const instName = (id: unknown) => (id ? inst.get(String(id)) ?? null : null);
    return NextResponse.json({
      participants: participants.map((u) => ({ id: String(u._id), name: u.name ?? null, email: u.email, status: u.status, institution: instName(u.institutionId) })),
      staff: staff.map((u) => ({ id: String(u._id), name: u.name ?? null, email: u.email, role: u.role, institution: instName(u.institutionId) })),
      institutions: institutions.map((i) => ({ id: String(i._id), name: i.name, code: i.code })),
      tests: tests.map((t) => ({ id: String(t._id), name: t.name, kind: t.kind })),
    });
  } catch (e) {
    return handleError(e);
  }
}
