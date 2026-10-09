import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { readTable } from "@/lib/import-parse";
import { mapQuestionRows, QUESTION_TEMPLATE_EXAMPLE, QUESTION_TEMPLATE_HEADER } from "@/lib/import-questions";
import { Question } from "@/models/Question";

export const dynamic = "force-dynamic";

/** Templat CSV impor soal. */
export async function GET() {
  try {
    await requireRole(["admin"]);
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
    const admin = await requireRole(["admin"]);
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    const rows = mapQuestionRows(await readTable(file, 500));
    if (rows.length === 1 && !rows[0].ok && rows[0].row === 1) throw new HttpError(400, rows[0].error);
    await connectDB();
    const failed = rows.filter((r): r is Extract<typeof r, { ok: false }> => !r.ok).map((r) => ({ row: r.row, reason: r.error }));
    const good = rows.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
    if (!dry) for (const g of good) await Question.create({ ...g.data, groupId: undefined });
    if (!dry) await audit(admin._id, "questions.import", file.name, { created: good.length, failed: failed.length });
    return NextResponse.json({ dry, created: good.length, failed });
  } catch (e) {
    return handleError(e);
  }
}
