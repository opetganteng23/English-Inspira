import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

/** Ringkasan peserta per institusi untuk kartu di halaman Participants (admin). */
export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const [rows, insts] = await Promise.all([
      User.aggregate([
        { $match: { role: "participant", deletedAt: { $exists: false } } },
        { $group: { _id: { i: "$institutionId", s: "$status" }, n: { $sum: 1 }, placed: { $sum: { $cond: [{ $ifNull: ["$placementAttemptId", false] }, 1, 0] } } } },
      ]),
      Institution.find().select("name code status batch").lean(),
    ]);
    const by = new Map<string, { total: number; active: number; invited: number; disabled: number; placed: number }>();
    for (const r of rows) {
      const k = r._id.i ? String(r._id.i) : "none";
      const c = by.get(k) ?? { total: 0, active: 0, invited: 0, disabled: 0, placed: 0 };
      c.total += r.n; c.placed += r.placed;
      if (r._id.s === "active" || r._id.s === "invited" || r._id.s === "disabled") c[r._id.s as "active"] += r.n;
      by.set(k, c);
    }
    const zero = { total: 0, active: 0, invited: 0, disabled: 0, placed: 0 };
    const cards = insts.map((i) => ({ id: String(i._id), name: i.name, code: i.code, batch: i.batch ?? null, status: i.status, ...(by.get(String(i._id)) ?? zero) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const none = by.get("none");
    return NextResponse.json({ cards: none ? [...cards, { id: "none", name: "No institution", code: "", batch: null, status: "active", ...none }] : cards });
  } catch (e) {
    return handleError(e);
  }
}
