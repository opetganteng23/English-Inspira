import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Material, MaterialVersion } from "@/models/Material";

const snap = (m: InstanceType<typeof Material>) => ({ title: m.title, summary: m.summary, kind: m.kind, contentJson: m.contentJson, contentHtml: m.contentHtml, htmlDoc: m.htmlDoc, tags: m.tags, access: m.access });

/** Publish: naikkan versi dan simpan snapshot agar bisa rollback. Body {action:"publish"|"unpublish"|"rollback", version?}. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Materi tidak ditemukan");
    const b = z.object({ action: z.enum(["publish", "unpublish", "rollback"]), version: z.number().int().optional() }).parse(await req.json());
    await connectDB();
    const m = await Material.findById(params.id);
    if (!m) throw new HttpError(404, "Materi tidak ditemukan");

    if (b.action === "unpublish") { m.status = "draft"; await m.save(); }
    else {
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
