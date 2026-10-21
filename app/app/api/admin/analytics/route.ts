import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { testSegments, DIMS, type Dim } from "@/lib/segments";
import { analyticsTests } from "@/lib/analytics-tests";

export const dynamic = "force-dynamic";

/** Analisis hasil tes per kelompok (keseluruhan, umur, cabang, provinsi, tanggal tes). Admin pusat: semua hasil termasuk yang ditahan. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const inst = sp.get("institution") || undefined;
    if (inst && !isValidObjectId(inst)) throw new HttpError(404, "Institution not found");
    const tests = await analyticsTests(inst);
    const test = sp.get("test") || tests[0]?.id;
    const dim = (DIMS.find((d) => d.key === sp.get("dim"))?.key ?? "branch") as Dim;
    const t = Number(sp.get("target"));
    if (!test) return NextResponse.json({ tests, dims: DIMS, data: null });
    if (!isValidObjectId(test)) throw new HttpError(404, "Test not found");
    return NextResponse.json({ tests, dims: DIMS, dim, data: await testSegments(test, dim, { institutionId: inst, target: t >= 310 && t <= 677 ? t : undefined }) });
  } catch (e) {
    return handleError(e);
  }
}
