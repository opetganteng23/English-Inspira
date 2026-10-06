import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { canReadMaterial } from "@/lib/materials";
import { Material, MaterialProgress } from "@/models/Material";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({ points: 20, duration: 60 });
const schema = z.object({ score: z.number().min(0).max(100), answers: z.unknown().optional() });

/**
 * Menerima progres dari materi (lewat jembatan postMessage di induk). Materi tidak pernah memanggil API langsung.
 * Parameter [slug] di sini berisi slug materi.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    try { await limiter.consume(String(user._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Terlalu sering"); throw e; }
    const b = schema.parse(await req.json());
    if (JSON.stringify(b.answers ?? null).length > 20_000) throw new HttpError(413, "Data jawaban terlalu besar");
    await connectDB();
    const m = await Material.findOne({ slug: params.slug, status: "published" }).select("access").lean();
    if (!m) throw new HttpError(404, "Materi tidak ditemukan");
    if (!(await canReadMaterial(user, m.access))) throw new HttpError(402, "Tidak punya akses");
    const p = await MaterialProgress.findOneAndUpdate(
      { userId: user._id, materialId: m._id },
      { $set: { score: b.score, answers: b.answers ?? null, completedAt: new Date() }, $inc: { attempts: 1 } },
      { upsert: true, new: true }
    );
    return NextResponse.json({ ok: true, attempts: p.attempts });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Data progres tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
