import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { featuresFor } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Saklar fitur untuk komponen klien (mis. panel AI Counselor di halaman hasil). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await featuresFor(user));
}
