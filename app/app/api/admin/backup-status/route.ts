import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/rbac";
import { backupStatus } from "@/lib/backup-status";

export const dynamic = "force-dynamic";

/** Status backup DB untuk Settings (Sesi 7.3). */
export async function GET() {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await backupStatus());
  } catch (e) {
    return handleError(e);
  }
}
