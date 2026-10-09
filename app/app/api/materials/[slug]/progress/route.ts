import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { Material, MaterialProgress } from "@/models/Material";
import { markMaterialDone } from "@/lib/units";
import { mongoSanitize } from "@/lib/mongo-sanitize";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({ points: 20, duration: 60 });
const schema = z.object({ score: z.number().min(0).max(100), answers: z.unknown().optional(), final: z.boolean().default(true) });

/**
 * Menerima progres dari materi (lewat jembatan postMessage di induk). Materi tidak pernah memanggil API langsung.
 * Parameter [slug] di sini berisi slug materi.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    try { await limiter.consume(String(user._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Terlalu sering"); throw e; }
    const b = schema.parse(await req.json());
    if (JSON.stringify(b.answers ?? null).length > 20_000) throw new HttpError(413, "Data jawaban terlalu besar");
    await connectDB();
    const m = await Material.findOne({ slug: params.slug, status: "published" }).select("access").lean();
    if (!m) throw new HttpError(404, "Materi tidak ditemukan");
    const p = await MaterialProgress.findOneAndUpdate(
      { userId: user._id, materialId: m._id },
      // Laporan sementara (final=false) hanya menyimpan skor terakhir; penyelesaian menandai selesai dan menambah percobaan.
      b.final ? { $set: { score: b.score, answers: mongoSanitize(b.answers ?? null), completedAt: new Date() }, $inc: { attempts: 1 } } : { $set: { score: b.score, answers: mongoSanitize(b.answers ?? null) }, $setOnInsert: { attempts: 0 } },
      { upsert: true, new: true }
    );
    if (b.final && user.role === "participant") await markMaterialDone(user, m._id); // memajukan unit yang mensyaratkan materi ini
    return NextResponse.json({ ok: true, attempts: p.attempts });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Data progres tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
