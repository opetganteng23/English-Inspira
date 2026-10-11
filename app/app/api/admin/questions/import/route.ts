import { registerQuestionType } from "@/lib/question-types";
import { recordQuestionVersion } from "@/lib/question-versions";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { readTable } from "@/lib/import-parse";
import { docxTextToTable, readDocxText } from "@/lib/import-docx";
import { mapQuestionRows, QUESTION_TEMPLATE_EXAMPLE, QUESTION_TEMPLATE_HEADER } from "@/lib/import-questions";
import { Question } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Templat CSV impor soal. */
const DOCX_EXAMPLE = [
  "Section: structure", "Type: subject-verb", "Difficulty: medium", "Tags: structure:subject-verb agreement", "Status: draft", "",
  "1. The results of the study ___ clear.", "A. is", "B. are", "C. was", "D. be", "Answer: B", "Explanation: The plural subject takes are.", "",
  "2. She ___ to school every day.", "A. go", "B. goes", "C. going", "D. gone", "Answer: B", "",
].join("\r\n");

export async function GET(req: Request) {
  try {
    await requireRole(CONTENT_ROLES);
    if (new URL(req.url).searchParams.get("format") === "word") return new Response(DOCX_EXAMPLE, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="question-import-word-format.txt"' } });
    const csv = [QUESTION_TEMPLATE_HEADER, QUESTION_TEMPLATE_EXAMPLE].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new Response("\uFEFF" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="question-import-template.csv"' } });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Impor soal dari CSV/Excel. Baris yang valid dibuat, baris gagal dilaporkan dengan alasannya (tidak menggagalkan seluruh impor).
 * `?dry=1` hanya memvalidasi (pratinjau). Soal published tanpa tag skill+topic ditolak seperti biasa.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(CONTENT_ROLES);
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    let table: string[][];
    if (file.name.toLowerCase().endsWith(".docx")) {
      if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "Maximum 4 MB");
      let text: string;
      try { text = await readDocxText(Buffer.from(await file.arrayBuffer())); } catch { throw new HttpError(400, "The file is not a valid Word (.docx) file"); }
      table = docxTextToTable(text);
      if (table.length < 2) throw new HttpError(400, "No questions found. Number each question (1. ...) and list options as A. B. C. D.");
      if (table.length > 501) throw new HttpError(413, "Maximum 500 questions per import");
    } else table = await readTable(file, 500);
    const rows = mapQuestionRows(table);
    if (rows.length === 1 && !rows[0].ok && rows[0].row === 1) throw new HttpError(400, rows[0].error);
    await connectDB();
    const failed = rows.filter((r): r is Extract<typeof r, { ok: false }> => !r.ok).map((r) => ({ row: r.row, reason: r.error }));
    const good = rows.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
    if (!dry) for (const g of good) { const nq = await Question.create({ ...g.data, ...(admin.role === "content_editor" && !["draft", "review"].includes(g.data.status) ? { status: "draft" } : {}), groupId: undefined }); await registerQuestionType(g.data.section, g.data.type); await recordQuestionVersion(nq._id, nq.toObject(), undefined, "Imported from file"); }
    if (!dry) await audit(admin._id, "questions.import", file.name, { created: good.length, failed: failed.length });
    return NextResponse.json({ dry, created: good.length, failed });
  } catch (e) {
    return handleError(e);
  }
}
