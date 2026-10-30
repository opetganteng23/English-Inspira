import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { estimateNarratives } from "@/lib/bg-jobs";

export const dynamic = "force-dynamic";

/** Perkiraan sebelum membuat narasi AI: berapa peserta, berapa yang sudah ada, perkiraan token. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    const sp = new URL(req.url).searchParams, test = sp.get("test") ?? "", inst = sp.get("institution");
    if (!isValidObjectId(test) || (inst && !isValidObjectId(inst))) throw new HttpError(404, "Test not found");
    const e = await estimateNarratives(test, inst ?? undefined);
    if (!e) throw new HttpError(404, "Test not found");
    return NextResponse.json(e);
  } catch (e) {
    return handleError(e);
  }
}
