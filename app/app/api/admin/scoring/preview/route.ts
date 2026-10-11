import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { previewScore, validateTables } from "@/lib/scoring-profiles";
import { profileInput } from "@/lib/scoring-schemas";
import { SECTIONS } from "@/models/Question";

const input = z.object({
  profile: profileInput,
  sections: z.array(z.object({ section: z.enum(SECTIONS), raw: z.number().int().min(0).max(300), total: z.number().int().min(1).max(300) })).min(1).max(3),
});

/** Kalkulator pratinjau: hitung skala section dan total dari skor mentah memakai aturan profil yang sedang diedit (belum disimpan). */
export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const b = input.parse(await req.json());
    const { errors, warnings } = validateTables(b.profile.mode, b.profile.scaledMin, b.profile.scaledMax, b.profile.tables);
    const result = previewScore({ mode: b.profile.mode, scaledMin: b.profile.scaledMin, scaledMax: b.profile.scaledMax, tables: b.profile.tables }, b.sections);
    return NextResponse.json({ ...result, errors, warnings });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
