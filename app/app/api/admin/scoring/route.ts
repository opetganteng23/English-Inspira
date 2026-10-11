import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { ensureDefaultProfile, validateTables } from "@/lib/scoring-profiles";
import { ScoringProfile } from "@/models/Scoring";
import { profileInput } from "@/lib/scoring-schemas";
import { Test, Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Daftar profil penilaian beserta pemakaiannya (tes yang memilihnya dan percobaan yang sudah dinilai dengannya). */
export async function GET() {
  try {
    await requireRole(["admin"]);
    await ensureDefaultProfile();
    const profiles = await ScoringProfile.find().sort({ isDefault: -1, createdAt: 1 }).lean();
    const out = [];
    for (const p of profiles) {
      const [tests, attempts] = await Promise.all([Test.countDocuments({ scoringProfileId: p._id }), Attempt.countDocuments({ scoringProfileId: p._id })]);
      out.push({ id: String(p._id), name: p.name, description: p.description ?? "", version: p.version, mode: p.mode, verified: p.verified, source: p.source ?? "", isDefault: p.isDefault, status: p.status, verifiedAt: p.verifiedAt ?? null, tests, attempts });
    }
    return NextResponse.json({ profiles: out });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = profileInput.parse(await req.json());
    await connectDB();
    const { errors, warnings } = validateTables(b.mode, b.scaledMin, b.scaledMax, b.tables);
    if (errors.length) throw new HttpError(400, errors[0]);
    if (await ScoringProfile.exists({ name: b.name })) throw new HttpError(409, "A profile with this name already exists");
    const p = await ScoringProfile.create({ ...b, verified: false });
    await audit(admin._id, "scoring.create", String(p._id), { name: b.name, mode: b.mode });
    return NextResponse.json({ id: String(p._id), warnings }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
