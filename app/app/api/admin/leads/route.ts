import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Lead } from "@/models/Material";
import { User } from "@/models/User";
import { Order } from "@/models/Commerce";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Lead = email yang masuk lewat landing page ATAU akun yang belum membeli, beserta tahapnya. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const [leads, users, paid, trials] = await Promise.all([
      Lead.find().sort({ createdAt: -1 }).limit(500).lean(),
      User.find({ role: "participant" }).sort({ createdAt: -1 }).limit(500).select("email name createdAt").lean(),
      Order.distinct("userId", { status: "paid" }),
      Attempt.find({ kind: "trial" }).select("userId status").lean(),
    ]);
    const paidSet = new Set(paid.map(String));
    const trialBy = new Map(trials.map((t) => [String(t.userId), t.status]));
    const rows = new Map<string, { email: string; name: string | null; source: string; stage: string; at: Date }>();
    for (const l of leads) rows.set(l.email, { email: l.email, name: null, source: l.source ?? "landing", stage: "Belum daftar", at: l.createdAt });
    for (const u of users) {
      if (paidSet.has(String(u._id))) { rows.delete(u.email); continue; } // sudah membeli: bukan lead lagi
      const t = trialBy.get(String(u._id));
      rows.set(u.email, { email: u.email, name: u.name ?? null, source: "akun", stage: t === "submitted" ? "Selesai free trial" : t ? "Mulai free trial" : "Sudah daftar", at: u.createdAt });
    }
    return NextResponse.json({ leads: Array.from(rows.values()).sort((a, b) => +b.at - +a.at) });
  } catch (e) {
    return handleError(e);
  }
}
