import { NextResponse } from "next/server";
import { handleError } from "@/lib/rbac";
import { instContext } from "@/lib/inst";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { inst, scoped } = await instContext(req);
    return NextResponse.json({ name: inst.name, code: inst.code, seats: inst.seats, used: await User.countDocuments(scoped()), validUntil: inst.validUntil ?? null, active: inst.active });
  } catch (e) {
    return handleError(e);
  }
}
