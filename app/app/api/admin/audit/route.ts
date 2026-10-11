import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SIZE = 30;

/**
 * Audit log: siapa mengubah apa dan kapan (kunci jawaban, materi, akun, pengaturan, akses data pribadi).
 * Filter: q (aksi atau target), group (awalan aksi, mis. "user"), actor (email), from/to (tanggal). `format=csv` mengekspor hasil filter.
 */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    const q = sp.get("q")?.trim();
    if (q) filter.$or = [{ action: { $regex: esc(q), $options: "i" } }, { target: { $regex: esc(q), $options: "i" } }];
    const group = sp.get("group");
    if (group && !q) filter.action = { $regex: `^${esc(group)}[._]`, $options: "i" };
    const actor = sp.get("actor")?.trim();
    if (actor) {
      const u = await User.find({ email: { $regex: esc(actor), $options: "i" } }).select("_id").limit(50).lean();
      filter.actorId = { $in: u.map((x) => x._id) };
    }
    const from = sp.get("from"), to = sp.get("to");
    if (from || to) {
      const at: Record<string, Date> = {};
      if (from && !isNaN(+new Date(from))) at.$gte = new Date(from);
      if (to && !isNaN(+new Date(to))) at.$lte = new Date(new Date(to).getTime() + 86_400_000 - 1);
      if (Object.keys(at).length) filter.at = at;
    }
    const csv = sp.get("format") === "csv";
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const [rows, total, groups] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip(csv ? 0 : (page - 1) * SIZE).limit(csv ? 5000 : SIZE).lean(),
      csv ? 0 : AuditLog.countDocuments(filter),
      csv ? [] : AuditLog.aggregate<{ _id: string }>([{ $group: { _id: { $arrayElemAt: [{ $split: [{ $replaceAll: { input: "$action", find: "_", replacement: "." } }, "."] }, 0] } } }, { $sort: { _id: 1 } }]),
    ]);
    const actors = new Map((await User.find({ _id: { $in: rows.map((r) => r.actorId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("name email role").lean()).map((u) => [String(u._id), u]));
    const items = rows.map((r) => {
      const a = r.actorId ? actors.get(String(r.actorId)) : null;
      return { id: String(r._id), at: r.at ?? r.createdAt, action: r.action, target: r.target ?? "", actor: a ? { name: a.name ?? "", email: a.email, role: a.role } : null, meta: r.meta ?? null };
    });
    if (csv) {
      const e = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const out = [["time", "actor", "role", "action", "target", "meta"], ...items.map((i) => [new Date(i.at as Date).toISOString(), i.actor?.email ?? "(system)", i.actor?.role ?? "", i.action, i.target, i.meta ? JSON.stringify(i.meta) : ""])];
      return new Response("﻿" + out.map((r) => r.map(e).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / SIZE)), groups: groups.map((g) => g._id).filter(Boolean) });
  } catch (e) {
    return handleError(e);
  }
}
