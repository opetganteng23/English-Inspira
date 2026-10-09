import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { injectAudio } from "@/lib/materials";
import { sanitizeRich } from "@/lib/sanitize";
import { Material, MaterialProgress } from "@/models/Material";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    await connectDB();
    const m = await Material.findOne({ slug: params.slug, ...(user.role === "admin" ? {} : { status: "published" }) }).lean();
    if (!m) throw new HttpError(404, "Materi tidak ditemukan");

    const id = String(m._id);
    const progress = await MaterialProgress.findOne({ userId: user._id, materialId: m._id }).lean();
    const base = { id, title: m.title, summary: m.summary, kind: m.kind, tags: m.tags, version: m.version, progress: progress ? { score: progress.score ?? null, completed: !!progress.completedAt, attempts: progress.attempts } : null };
    if (m.kind === "html") {
      const d = m.htmlDoc ?? {};
      return NextResponse.json({ ...base, htmlDoc: { html: await injectAudio(d.html ?? "", id), css: d.css ?? "", js: await injectAudio(d.js ?? "", id) } });
    }
    // Sanitasi ulang saat tampil (pertahanan berlapis); audio diberi URL bertanda tangan.
    return NextResponse.json({ ...base, contentHtml: await injectAudio(sanitizeRich(m.contentHtml ?? ""), id) });
  } catch (e) {
    return handleError(e);
  }
}
