import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { accessSummary } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    return NextResponse.json(await accessSummary(user._id));
  } catch (e) {
    return handleError(e);
  }
}
