import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { buildInstSummary } from "@/lib/inst-summary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { inst, scoped, full } = await instContext(req);
    return NextResponse.json(await buildInstSummary(inst, scoped, full));
  } catch (e) {
    return handleError(e);
  }
}
