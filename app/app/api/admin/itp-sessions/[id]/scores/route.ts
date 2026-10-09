import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { applyOfficialScore } from "@/lib/itp-score";
import { ItpRegistration } from "@/models/Itp";

/** Impor skor dari Excel (kolom registrationId, listening, structure, reading), yaitu hasil ekspor roster yang diisi mitra. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Schedule not found");
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "Maximum 5 MB");
    await connectDB();

    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { throw new HttpError(400, "The file is not a valid Excel (.xlsx) file"); }
    const ws = wb.worksheets[0];
    if (!ws) throw new HttpError(400, "The worksheet is empty");
    const head = new Map<string, number>();
    ws.getRow(1).eachCell((c, n) => head.set(String(c.value).trim().toLowerCase(), n));
    for (const k of ["registrationid", "listening", "structure", "reading"]) if (!head.has(k)) throw new HttpError(400, `Column "${k}" not found`);

    const errors: { row: number; error: string }[] = [];
    let ok = 0;
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const get = (k: string) => row.getCell(head.get(k)!).value;
      const id = String(get("registrationid") ?? "").trim();
      if (!id) continue;
      const [l, s, r] = ["listening", "structure", "reading"].map((k) => Number(get(k)));
      if ([l, s, r].some((v) => Number.isNaN(v))) { errors.push({ row: i, error: "Score is empty or not a number" }); continue; }
      try {
        // Baris hanya boleh menyentuh pendaftaran milik jadwal ini.
        if (!(await ItpRegistration.exists({ _id: id, sessionId: params.id }))) throw new HttpError(404, "Not a participant of this schedule");
        await applyOfficialScore(id, { listening: l, structure: s, reading: r });
        ok++;
      } catch (e) { errors.push({ row: i, error: e instanceof HttpError ? e.message : "Save failed" }); }
    }
    await audit(admin._id, "itp.scores_import", params.id, { ok, errors: errors.length });
    return NextResponse.json({ ok, errors });
  } catch (e) {
    return handleError(e);
  }
}
