import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Material, MaterialProgress } from "@/models/Material";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin"]);
    await connectDB();
    const list = await Material.find({ status: "published" }).select("title slug summary kind tags access publishedAt").sort({ publishedAt: -1 }).lean();
    const prog = new Map((await MaterialProgress.find({ userId: user._id, materialId: { $in: list.map((m) => m._id) } }).lean()).map((p) => [String(p.materialId), p]));
    return NextResponse.json({
      materials: list.map((m) => ({
        id: String(m._id), title: m.title, slug: m.slug, summary: m.summary, kind: m.kind, tags: m.tags, access: m.access,
        locked: false,
        progress: prog.has(String(m._id)) ? { score: prog.get(String(m._id))!.score ?? null, completed: !!prog.get(String(m._id))!.completedAt } : null,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
