import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { Question, QuestionType } from "@/models/Question";

const CI = { locale: "en", strength: 2 } as const;

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Type not found");
  await connectDB();
  const t = await QuestionType.findById(id);
  if (!t) throw new HttpError(404, "Type not found");
  return t;
}

const patchInput = z.object({
  name: z.string().trim().min(1, "Enter a type name").max(80).optional(),
  description: z.string().trim().max(300).optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

/** Ubah nama (soal ikut berubah), deskripsi, urutan, atau aktif/nonaktif (jenis nonaktif tidak muncul di form soal baru). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    const b = patchInput.parse(await req.json());
    if (b.name && b.name.toLowerCase() !== t.name.toLowerCase()) {
      if (await QuestionType.findOne({ section: t.section, name: b.name, _id: { $ne: t._id } }).collation(CI)) throw new HttpError(409, "A type with this name already exists in this category");
    }
    const old = t.name;
    if (b.name !== undefined) t.name = b.name;
    if (b.description !== undefined) t.description = b.description;
    if (b.active !== undefined) t.active = b.active;
    if (b.order !== undefined) t.order = b.order;
    await t.save();
    let moved = 0;
    if (b.name && b.name !== old) moved = (await Question.updateMany({ section: t.section, type: old }, { type: b.name }, { collation: CI })).modifiedCount;
    await audit(admin._id, "question_type.update", params.id, { ...b, questionsUpdated: moved });
    return NextResponse.json({ ok: true, questionsUpdated: moved });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Hapus jenis. Bila masih dipakai soal: tolak, kecuali `?moveTo=<id jenis lain di kategori yang sama>` memindahkan soalnya. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const t = await find(params.id);
    const used = await Question.countDocuments({ section: t.section, type: t.name }).collation(CI);
    const moveTo = new URL(req.url).searchParams.get("moveTo");
    if (used > 0) {
      if (!moveTo) throw new HttpError(409, `${used} question${used > 1 ? "s use" : " uses"} this type. Choose another type to move them to.`);
      const target = await find(moveTo);
      if (target.section !== t.section || String(target._id) === String(t._id)) throw new HttpError(400, "Choose a different type in the same category");
      await Question.updateMany({ section: t.section, type: t.name }, { type: target.name }, { collation: CI });
    }
    await t.deleteOne();
    await audit(admin._id, "question_type.delete", params.id, { name: t.name, moved: used, moveTo: moveTo ?? undefined });
    return NextResponse.json({ ok: true, moved: used });
  } catch (e) {
    return handleError(e);
  }
}
