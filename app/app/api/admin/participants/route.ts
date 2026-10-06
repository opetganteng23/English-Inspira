import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { User } from "@/models/User";
import { Order, Entitlement, Product } from "@/models/Commerce";
import { Attempt } from "@/models/Test";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = { role: "participant" };
    const q = sp.get("q")?.trim();
    if (q) { const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); filter.$or = [{ name: rx }, { email: rx }]; }
    if (sp.get("institution")) filter.institutionId = sp.get("institution") === "none" ? { $exists: false } : sp.get("institution");
    const stage = sp.get("stage");
    const page = Math.max(1, Number(sp.get("page")) || 1), size = 25;

    // Tahap diturunkan dari data: institusi > journey > pembeli > free trial > baru. Disaring setelah ditentukan.
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(2000).lean();
    const ids = users.map((u) => u._id);
    const [paid, attempts, ents, insts] = await Promise.all([
      Order.find({ userId: { $in: ids }, status: "paid" }).select("userId items").lean(),
      Attempt.find({ userId: { $in: ids }, status: "submitted" }).sort({ finishedAt: -1 }).select("userId kind scoreEst finishedAt").lean(),
      Entitlement.find({ userId: { $in: ids }, revokedAt: { $exists: false } }).select("userId productId expiresAt").lean(),
      Institution.find().select("name").lean(),
    ]);
    const journeyIds = new Set((await Product.find({ kind: "journey" }).select("_id").lean()).map((p) => String(p._id)));
    const instName = new Map(insts.map((i) => [String(i._id), i.name]));
    const rows = users.map((u) => {
      const id = String(u._id);
      const myOrders = paid.filter((o) => String(o.userId) === id);
      const mine = attempts.filter((a) => String(a.userId) === id);
      const hasJourney = ents.some((e) => String(e.userId) === id && e.productId && journeyIds.has(String(e.productId)));
      const st = u.institutionId ? "Institusi" : hasJourney ? "Journey" : myOrders.length ? "Pembeli" : mine.length ? "Free trial" : "Baru";
      const last = mine[0]?.scoreEst ?? null;
      const target = u.targetScore ?? null;
      const readiness = last && target ? (last >= target ? "Siap" : last >= target - 30 ? "Hampir" : "Belum") : "-";
      return { id, name: u.name ?? null, email: u.email, stage: st, institution: u.institutionId ? instName.get(String(u.institutionId)) ?? "-" : null, lastScore: last, target, readiness, status: u.status, orders: myOrders.length, createdAt: u.createdAt };
    }).filter((r) => !stage || r.stage === stage);
    return NextResponse.json({ total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / size)), participants: rows.slice((page - 1) * size, page * size) });
  } catch (e) {
    return handleError(e);
  }
}
