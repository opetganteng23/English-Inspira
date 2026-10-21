import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, HttpError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { testSegments, DIMS, type Dim } from "@/lib/segments";
import { analyticsTests } from "@/lib/analytics-tests";

export const dynamic = "force-dynamic";

/** Analisis per kelompok untuk portal institusi: hanya peserta institusi ini; admin institusi hanya melihat hasil yang sudah dirilis. */
export async function GET(req: Request) {
  try {
    const { inst, full } = await instContext(req);
    const sp = new URL(req.url).searchParams;
    const tests = await analyticsTests(String(inst._id));
    const test = sp.get("test") || tests[0]?.id;
    const dim = (DIMS.find((d) => d.key === sp.get("dim"))?.key ?? "branch") as Dim;
    const t = Number(sp.get("target"));
    if (!test) return NextResponse.json({ tests, dims: DIMS, data: null });
    if (!isValidObjectId(test) || !tests.some((x) => x.id === test)) throw new HttpError(404, "Test not found");
    return NextResponse.json({ tests, dims: DIMS, dim, data: await testSegments(test, dim, { institutionId: String(inst._id), releasedOnly: !full, target: t >= 310 && t <= 677 ? t : undefined }) });
  } catch (e) {
    return handleError(e);
  }
}
