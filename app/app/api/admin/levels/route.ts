import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Level } from "@/models/Config";
import { getLevels } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ levels: (await getLevels()).map((l) => ({ id: String(l._id), key: l.key, name: l.name, order: l.order })) });
  } catch (e) {
    return handleError(e);
  }
}

const level = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/, "Key: huruf kecil/angka"),
  name: z.string().trim().min(1).max(40),
  order: z.number().int().min(1).max(20),
  scoreMin: z.number().int().min(310).max(677),
  scoreMax: z.number().int().min(310).max(677),
  coachingQuota: z.number().int().min(0).max(100),
});

/**
 * Ganti rentang/kuota level. Rentang tidak boleh tumpang tindih; level yang sudah dipakai tidak dihapus
 * (mengubah rentang langsung memengaruhi placement berikutnya, tanpa ubah kode).
 */
export async function PUT(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const { levels } = z.object({ levels: z.array(level).min(1).max(10) }).parse(await req.json());
    const sorted = [...levels].sort((a, b) => a.order - b.order);
    for (const l of sorted) if (l.scoreMin > l.scoreMax) throw new HttpError(400, `${l.name}: batas bawah melebihi batas atas`);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].scoreMin <= sorted[i - 1].scoreMax) throw new HttpError(400, `Rentang ${sorted[i - 1].name} dan ${sorted[i].name} tumpang tindih`);
    if (new Set(levels.map((l) => l.key)).size !== levels.length || new Set(levels.map((l) => l.order)).size !== levels.length) throw new HttpError(400, "Key dan urutan level harus unik");
    await connectDB();
    for (const l of levels) await Level.updateOne({ key: l.key }, l, { upsert: true });
    await audit(admin._id, "levels.update", undefined, { levels });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
