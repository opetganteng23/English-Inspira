import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getAllParams, getLevels, setParam, PARAM_SCHEMAS, type ParamKey } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Parameter Sistem (MTS §5): semua angka yang dapat diubah admin tanpa mengubah kode. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    const levels = await getLevels();
    return NextResponse.json({ params: await getAllParams(), levels: levels.map((l) => ({ key: l.key, name: l.name, order: l.order, scoreMin: l.scoreMin, scoreMax: l.scoreMax, coachingQuota: l.coachingQuota })) });
  } catch (e) {
    return handleError(e);
  }
}

const body = z.object({ key: z.string(), value: z.unknown() });
export async function PUT(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const { key, value } = body.parse(await req.json());
    if (!(key in PARAM_SCHEMAS)) return NextResponse.json({ error: "Unknown parameter" }, { status: 404 });
    await setParam(key as ParamKey, value, admin._id);
    await audit(admin._id, "param.update", key, { value });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid value for this parameter" }, { status: 400 });
    return handleError(e);
  }
}
