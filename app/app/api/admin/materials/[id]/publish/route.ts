import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Material, MaterialVersion } from "@/models/Material";
import { User } from "@/models/User";

const snap = (m: InstanceType<typeof Material>) => ({ title: m.title, summary: m.summary, kind: m.kind, contentJson: m.contentJson, contentHtml: m.contentHtml, htmlDoc: m.htmlDoc, tags: m.tags, access: m.access });

/**
 * Alur materi: draft → review → published. Materi HTML WAJIB lewat review, dan penerbit harus berbeda dari penyunting
 * terakhir kecuali hanya ada satu admin aktif. Rich text boleh langsung terbit. Setiap langkah masuk audit log.
 * Body {action:"submit_review"|"reject"|"publish"|"unpublish"|"rollback", version?, note?}.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Materi tidak ditemukan");
    const b = z.object({ action: z.enum(["submit_review", "reject", "publish", "unpublish", "rollback"]), version: z.number().int().optional(), note: z.string().trim().max(500).optional() }).parse(await req.json());
    await connectDB();
    const m = await Material.findById(params.id);
    if (!m) throw new HttpError(404, "Materi tidak ditemukan");

    if (b.action === "submit_review") {
      if (m.status !== "draft") throw new HttpError(409, "Hanya draf yang bisa diajukan untuk review");
      m.status = "review"; m.reviewNote = undefined; await m.save();
    } else if (b.action === "reject") {
      if (m.status !== "review") throw new HttpError(409, "Materi tidak sedang dalam review");
      if (!b.note || b.note.length < 3) throw new HttpError(400, "Alasan penolakan wajib diisi");
      m.status = "draft"; m.reviewNote = b.note; await m.save();
    } else if (b.action === "unpublish") { m.status = "draft"; await m.save(); }
    else {
      if (b.action === "publish" && m.kind === "html") {
        if (m.status !== "review") throw new HttpError(409, "Materi HTML harus diajukan untuk review dulu");
        const admins = await User.countDocuments({ role: "admin", status: "active" });
        if (admins > 1 && m.editorId && String(m.editorId) === String(admin._id)) throw new HttpError(403, "Penerbit harus berbeda dari penyunting terakhir");
        m.reviewerId = admin._id; m.reviewedAt = new Date();
      }
      if (b.action === "rollback") {
        const v = await MaterialVersion.findOne({ materialId: m._id, version: b.version });
        if (!v) throw new HttpError(404, "Versi tidak ditemukan");
        m.set(v.snapshot as object);
      }
      m.version += 1;
      m.status = "published";
      m.publishedAt = new Date();
      await m.save();
      await MaterialVersion.create({ materialId: m._id, version: m.version, snapshot: snap(m), authorId: admin._id });
    }
    await audit(admin._id, `material.${b.action}`, params.id, { version: m.version });
    return NextResponse.json({ ok: true, version: m.version, status: m.status });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Materi tidak ditemukan");
    await connectDB();
    const vs = await MaterialVersion.find({ materialId: params.id }).select("version createdAt").sort({ version: -1 }).lean();
    return NextResponse.json({ versions: vs.map((v) => ({ version: v.version, at: v.createdAt })) });
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
