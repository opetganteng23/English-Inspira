import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleError } from "@/lib/rbac";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
    return NextResponse.json({
      id: String(u._id), email: u.email, name: u.name ?? null, role: u.role,
      institutionId: u.institutionId ? String(u.institutionId) : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
