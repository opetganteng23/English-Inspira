import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Saklar fitur untuk komponen klien (mis. panel AI Counselor di halaman hasil). */
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await getFeatures());
}
