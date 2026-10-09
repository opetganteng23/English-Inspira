import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { buildInstSummary } from "@/lib/inst-summary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { inst, scoped } = await instContext(req);
    return NextResponse.json(await buildInstSummary(inst, scoped));
  } catch (e) {
    return handleError(e);
  }
}
