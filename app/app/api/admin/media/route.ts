import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, CONTENT_ROLES } from "@/lib/rbac";
import { assetUsage } from "@/lib/media";
import { Asset } from "@/models/Asset";

export const dynamic = "force-dynamic";

/** Media Library: gambar publik (soal, materi, cover, landing). Foto pribadi peserta (sensitif) tidak pernah masuk daftar ini. */
export async function GET(req: Request) {
  try {
    await requireRole(CONTENT_ROLES);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1), size = 24;
    const q = (sp.get("q") ?? "").trim().slice(0, 60);
    await connectDB();
    const filter: Record<string, unknown> = { sensitive: false };
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [rows, total, bytes] = await Promise.all([
      Asset.find(filter).select("-dataBase64").sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
      Asset.countDocuments(filter),
      Asset.aggregate([{ $match: { sensitive: false } }, { $group: { _id: null, size: { $sum: "$size" }, n: { $sum: 1 } } }]),
    ]);
    const usage = await assetUsage(rows.map((r) => r._id));
    return NextResponse.json({
      total, page, size, library: { files: bytes[0]?.n ?? 0, bytes: bytes[0]?.size ?? 0 },
      items: rows.map((a) => ({ id: String(a._id), name: (a as { name?: string }).name ?? "", mime: a.mime, size: a.size, width: a.width ?? null, height: a.height ?? null, createdAt: (a as { createdAt?: Date }).createdAt, url: `/api/assets/${a._id}`, usage: usage.get(String(a._id)) ?? [] })),
    });
  } catch (e) {
    return handleError(e);
  }
}
