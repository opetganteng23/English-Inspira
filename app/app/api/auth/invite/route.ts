import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invitation } from "@/models/Access";
import { Institution } from "@/models/Institution";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";
import { sha256 } from "@/lib/participants";

export const dynamic = "force-dynamic";

/** Tautan undangan → isi otomatis email di halaman Masuk. Token salah/kedaluwarsa = 404 generik. */
export async function GET(req: Request) {
  try {
    await limit("verifyIp", clientIp(req));
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!/^[0-9a-f]{48}$/.test(token)) return NextResponse.json({ error: "Undangan tidak valid atau sudah kedaluwarsa" }, { status: 404 });
    await connectDB();
    const inv = await Invitation.findOne({ tokenHash: sha256(token), status: "pending", expiresAt: { $gt: new Date() } }).lean();
    if (!inv) return NextResponse.json({ error: "Undangan tidak valid atau sudah kedaluwarsa" }, { status: 404 });
    const inst = await Institution.findById(inv.institutionId).select("name").lean();
    return NextResponse.json({ email: inv.email, institution: inst?.name ?? null });
  } catch (e) {
    return handleError(e);
  }
}
