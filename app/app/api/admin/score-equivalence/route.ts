import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { getEquivalence, setEquivalence } from "@/lib/clustering";
import { equivalenceSchema, ITP_CEFR } from "@/lib/score-equivalence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    return NextResponse.json({ equivalence: await getEquivalence(), itpCefr: ITP_CEFR });
  } catch (e) {
    return handleError(e);
  }
}

/** Tabel padanan OCE/PURE. Hasil yang sudah dikonfirmasi tidak dihitung ulang (skor ITP-nya tersimpan saat itu). */
export async function PUT(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const b = equivalenceSchema.parse(await req.json());
    await setEquivalence(b);
    await audit(admin._id, "score_equivalence.update", "score_equivalence", b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
