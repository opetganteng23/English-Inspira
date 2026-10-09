import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { coachingMonitor } from "@/lib/coaching-monitor";

export const dynamic = "force-dynamic";

/** Pantauan coaching per institusi (MTS §16.5). Logika di lib/coaching-monitor.ts agar job peringatan memakai angka yang sama. */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ institutions: await coachingMonitor() });
  } catch (e) {
    return handleError(e);
  }
}
