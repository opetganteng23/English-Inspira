import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Question, QuestionGroup } from "@/models/Question";
import { registerQuestionType } from "@/lib/question-types";
import { questionSchema } from "@/lib/admin-schemas";
import { AuditLog } from "@/models/AuditLog";


const escapeRegex = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    for (const k of ["section", "status", "difficulty"]) if (sp.get(k)) filter[k] = sp.get(k);
    // Jenis dicocokkan tanpa membedakan huruf besar/kecil (soal lama bisa menulisnya berbeda dari daftar jenis).
    if (sp.get("type")) filter.type = { $regex: "^" + escapeRegex(sp.get("type")!) + "$", $options: "i" };
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
      Question.find(filter).select("section type stem status difficulty groupId tags explanation updatedAt").sort({ updatedAt: -1 }).skip((page - 1) * size).limit(size).lean(),
      Question.countDocuments(filter),
    ]);
    // Validasi kualitas: soal yang perlu dilengkapi (tanpa tag, tanpa pembahasan, Listening tanpa grup audio/passage).
    const gids = Array.from(new Set(items.map((i) => i.groupId).filter(Boolean).map(String)));
    const groups = gids.length ? await QuestionGroup.find({ _id: { $in: gids } }).select("audioId passageHtml").lean() : [];
    const gmap = new Map(groups.map((g) => [String(g._id), g]));
    const withIssues = items.map((i) => {
      const issues: string[] = [];
      if (!i.tags?.length) issues.push("No skill/topic tag");
      if (!i.explanation) issues.push("No explanation");
      const g = i.groupId ? gmap.get(String(i.groupId)) : null;
      if (i.section === "listening" && !(g && g.audioId)) issues.push("No audio group");
      if (i.section === "reading" && !(g && g.passageHtml)) issues.push("No passage group");
      return { ...i, explanation: undefined, issues };
    });
    return NextResponse.json({ items: withIssues, total, page, pages: Math.ceil(total / size) });
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
    await registerQuestionType(body.section, body.type);
    await AuditLog.create({ actorId: admin._id, action: "question.create", target: String(q._id) });
    return NextResponse.json({ id: String(q._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
