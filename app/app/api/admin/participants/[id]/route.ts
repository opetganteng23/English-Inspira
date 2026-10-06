import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { User } from "@/models/User";
import { Order, Entitlement, Product } from "@/models/Commerce";
import { Attempt } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";
import { Institution } from "@/models/Institution";

export const dynamic = "force-dynamic";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Peserta tidak ditemukan");
  await connectDB();
  const u = await User.findById(id);
  if (!u) throw new HttpError(404, "Peserta tidak ditemukan");
  return u;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    const u = await find(params.id);
    const [orders, ents, attempts, notes, inst] = await Promise.all([
      Order.find({ userId: u._id }).select("invoiceNo status total items createdAt paidAt").sort({ createdAt: -1 }).limit(20).lean(),
      Entitlement.find({ userId: u._id }).sort({ createdAt: -1 }).lean(),
      Attempt.find({ userId: u._id, status: "submitted" }).sort({ finishedAt: -1 }).limit(20).select("kind scoreEst sectionScores finishedAt proctorFlags").lean(),
      AuditLog.find({ target: params.id, action: "participant.note" }).sort({ at: -1 }).limit(30).lean(),
      u.institutionId ? Institution.findById(u.institutionId).select("name").lean() : null,
    ]);
    const prods = new Map((await Product.find({ _id: { $in: ents.map((e) => e.productId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name").lean()).map((p) => [String(p._id), p.name]));
    return NextResponse.json({
      profile: { id: String(u._id), name: u.name, email: u.email, phone: u.phone, targetScore: u.targetScore, goal: u.goal, education: u.education, status: u.status, institution: inst?.name ?? null, createdAt: u.createdAt },
      orders: orders.map((o) => ({ id: String(o._id), invoiceNo: o.invoiceNo, status: o.status, total: o.total, items: o.items.map((i) => i.name), createdAt: o.createdAt })),
      entitlements: ents.map((e) => ({ id: String(e._id), product: e.productId ? prods.get(String(e.productId)) ?? "-" : "-", source: e.source, grants: e.grants, expiresAt: e.expiresAt ?? null, revoked: !!e.revokedAt, note: e.note })),
      attempts: attempts.map((a) => ({ id: String(a._id), kind: a.kind, scoreEst: a.scoreEst, sections: a.sectionScores, finishedAt: a.finishedAt, flags: a.proctorFlags.length })),
      notes: notes.map((n) => ({ text: (n.meta as { text?: string })?.text ?? "", at: n.at })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Catatan admin tersimpan sebagai audit log (jejak siapa menulis apa). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    await find(params.id);
    const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(await req.json());
    await audit(admin._id, "participant.note", params.id, { text });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Catatan kosong" }, { status: 400 });
    return handleError(e);
  }
}
