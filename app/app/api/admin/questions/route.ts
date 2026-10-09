import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Question } from "@/models/Question";
import { questionSchema } from "@/lib/admin-schemas";
import { AuditLog } from "@/models/AuditLog";


export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    for (const k of ["section", "status", "type", "difficulty"]) if (sp.get(k)) filter[k] = sp.get(k);
    // ?ids=a,b,c: ambil soal tertentu (untuk perakit tes), urutan mengikuti ids.
    const ids = (sp.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f]{24}$/.test(x)).slice(0, 200);
    if (sp.has("ids")) {
      const found = await Question.find({ _id: { $in: ids } }).select("section type stem status").lean();
      const by = new Map(found.map((x) => [String(x._id), x]));
      return NextResponse.json({ items: ids.map((i) => by.get(i)).filter(Boolean) });
    }
    const q = sp.get("q")?.trim();
    if (q) filter.stem = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const size = 20;
    const [items, total] = await Promise.all([
      Question.find(filter).select("section type stem status difficulty groupId tags updatedAt").sort({ updatedAt: -1 }).skip((page - 1) * size).limit(size).lean(),
      Question.countDocuments(filter),
    ]);
    return NextResponse.json({ items, total, page, pages: Math.ceil(total / size) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const body = questionSchema.parse(await req.json());
    await connectDB();
    const q = await Question.create({ ...body, groupId: body.groupId ?? undefined });
    await AuditLog.create({ actorId: admin._id, action: "question.create", target: String(q._id) });
    return NextResponse.json({ id: String(q._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
