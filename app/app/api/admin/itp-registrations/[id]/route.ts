import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { decryptField } from "@/lib/crypto";
import { applyOfficialScore } from "@/lib/itp-score";
import { ItpRegistration } from "@/models/Itp";

async function find(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Registration not found");
  await connectDB();
  const r = await ItpRegistration.findById(id);
  if (!r) throw new HttpError(404, "Registration not found");
  return r;
}

/** Verifikasi dokumen: valid -> pendaftaran terkonfirmasi; rejected butuh catatan. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const r = await find(params.id);
    const b = z.object({ docStatus: z.enum(["pending", "valid", "rejected"]), docNote: z.string().max(500).optional() }).parse(await req.json());
    if (b.docStatus === "rejected" && !b.docNote?.trim()) throw new HttpError(400, "Enter the document rejection reason");
    r.docStatus = b.docStatus;
    r.docNote = b.docNote;
    if (b.docStatus === "valid" && r.status === "submitted") r.status = "confirmed";
    await r.save();
    await audit(admin._id, "itp.doc_review", params.id, { docStatus: b.docStatus });
    return NextResponse.json({ ok: true, status: r.status });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

/** Skor resmi: PUT {listening, structure, reading}. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    await find(params.id);
    const b = z.object({ listening: z.number(), structure: z.number(), reading: z.number() }).parse(await req.json());
    const out = await applyOfficialScore(params.id, b);
    await audit(admin._id, "itp.score", params.id, { total: out.total });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

/** Tampilkan NIK lengkap (dekripsi) untuk satu pendaftaran; dicatat di audit log. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["admin"]);
    const r = await find(params.id);
    await audit(admin._id, "pii.reveal_nik", params.id);
    return NextResponse.json({ nik: decryptField(r.nikEnc), birthDate: r.birthDate, gender: r.gender });
  } catch (e) {
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
