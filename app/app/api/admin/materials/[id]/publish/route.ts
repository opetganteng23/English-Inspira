import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { handleError, HttpError } from "@/lib/rbac";
import { assertCanWrite, requireAuthor } from "@/lib/material-authz";
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
    const admin = await requireAuthor();
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Material not found");
    const b = z.object({ action: z.enum(["submit_review", "reject", "publish", "unpublish", "rollback"]), version: z.number().int().optional(), note: z.string().trim().max(500).optional() }).parse(await req.json());
    await connectDB();
    const m = await Material.findById(params.id);
    if (!m) throw new HttpError(404, "Material not found");
    assertCanWrite(admin, m);

    if (b.action === "submit_review") {
      if (m.status !== "draft") throw new HttpError(409, "Only drafts can be submitted for review");
      m.status = "review"; m.reviewNote = undefined; await m.save();
    } else if (b.action === "reject") {
      if (m.status !== "review") throw new HttpError(409, "The material is not under review");
      if (!b.note || b.note.length < 3) throw new HttpError(400, "A rejection reason is required");
      m.status = "draft"; m.reviewNote = b.note; await m.save();
    } else if (b.action === "unpublish") { m.status = "draft"; await m.save(); }
    else {
      if (b.action === "publish" && m.kind === "html") {
        if (m.status !== "review") throw new HttpError(409, "HTML materials must be submitted for review first");
        const admins = await User.countDocuments({ role: "admin", status: "active" });
        if (admins > 1 && m.editorId && String(m.editorId) === String(admin._id)) throw new HttpError(403, "The publisher must be different from the last editor");
        m.reviewerId = admin._id; m.reviewedAt = new Date();
      }
      if (b.action === "rollback") {
        const v = await MaterialVersion.findOne({ materialId: m._id, version: b.version });
        if (!v) throw new HttpError(404, "Version not found");
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
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireAuthor();
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Material not found");
    await connectDB();
    const own = await Material.findById(params.id).select("institutionId kind");
    if (!own) throw new HttpError(404, "Material not found");
    assertCanWrite(me, own);
    const vs = await MaterialVersion.find({ materialId: params.id }).select("version createdAt").sort({ version: -1 }).lean();
    return NextResponse.json({ versions: vs.map((v) => ({ version: v.version, at: v.createdAt })) });
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
