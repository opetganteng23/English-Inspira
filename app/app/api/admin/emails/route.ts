import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { MailJob } from "@/models/Access";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Log email (Sesi 7.2): antrean email dibaca sebagai riwayat. Isi email (data, termasuk kode OTP) tidak pernah dikirim ke browser. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status"), q = (sp.get("q") ?? "").trim().slice(0, 80), page = Math.max(1, Number(sp.get("page")) || 1), size = 50;
    const since = new Date(Date.now() - 7 * 86_400_000);
    const filter: Record<string, unknown> = {};
    if (status && ["queued", "sending", "sent", "failed"].includes(status)) filter.status = status;
    if (q) filter.$or = [{ to: new RegExp(esc(q), "i") }, { template: new RegExp(esc(q), "i") }];
    const [items, total, counts] = await Promise.all([
      MailJob.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).select("to template status tries lastError createdAt sentAt nextTryAt").lean(),
      MailJob.countDocuments(filter),
      MailJob.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    return NextResponse.json({
      counts7d: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      items: items.map((m) => ({ id: String(m._id), to: m.to, template: m.template, status: m.status, tries: m.tries, error: m.lastError ?? null, createdAt: m.createdAt, sentAt: m.sentAt ?? null, nextTryAt: m.nextTryAt ?? null })),
    });
  } catch (e) {
    return handleError(e);
  }
}
