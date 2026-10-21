import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { importPersonnel } from "@/lib/import-personnel";

export const dynamic = "force-dynamic";

/** Impor data kepegawaian (Excel HR) ke profil peserta institusi ini. ?dry=1: hanya pratinjau, tidak menyimpan. Admin pusat saja. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Institution not found");
    const dry = new URL(req.url).searchParams.has("dry");
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    if (file.size > 15 * 1024 * 1024) throw new HttpError(413, "File is larger than 15 MB");
    let out;
    try { out = await importPersonnel(Buffer.from(await file.arrayBuffer()), params.id, { dryRun: dry }); } catch (e) { throw new HttpError(400, (e as Error).message); }
    if (!dry) await audit(admin._id, "institution.personnel_import", params.id, { rows: out.rows, matched: out.matched, updated: out.updated });
    return NextResponse.json({ dry, ...out });
  } catch (e) {
    return handleError(e);
  }
}
