import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Question } from "@/models/Question";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ekspor soal ke CSV dengan kolom yang sama dengan templat impor (bisa diimpor kembali). Filter: section, type, status, difficulty. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    for (const k of ["section", "status", "difficulty"]) if (sp.get(k)) filter[k] = sp.get(k);
    if (sp.get("type")) filter.type = { $regex: "^" + sp.get("type")!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" };
    const qs = await Question.find(filter).sort({ section: 1, type: 1, createdAt: 1 }).limit(5000).lean();
    const head = ["section", "type", "stem", "A", "B", "C", "D", "E", "F", "answer", "explanation", "difficulty", "tags", "status"];
    const rows = qs.map((q) => [
      q.section, q.type, q.stem, ...Array.from({ length: 6 }, (_, i) => q.options[i] ?? ""), "ABCDEF"[q.answerKey] ?? "", q.explanation ?? "", q.difficulty,
      (q.tags ?? []).map((t) => `${t.skill}:${t.topic}`).join("; "), q.status,
    ]);
    const csv = [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="questions-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
