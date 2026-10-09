import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { maskName } from "@/lib/crypto";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";
import { Certificate } from "@/models/Itp";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/** Verifikasi publik (tujuan QR). Hanya data minimum: nama disamarkan, tanpa NIK/kontak. */
export async function GET(req: Request, { params }: { params: { number: string } }) {
  try {
    await limit("verifyIp", clientIp(req));
    if (!/^EPTA-(ITP|RPT)-\d{4}-\d{4,6}$/.test(params.number)) return NextResponse.json({ valid: false }, { status: 404 });
    await connectDB();
    const c = await Certificate.findOne({ number: params.number }).lean();
    if (!c) return NextResponse.json({ valid: false }, { status: 404 });
    const d = (c.data ?? {}) as { name?: string; scores?: { total?: number } };
    const name = d.name ?? (await User.findById(c.userId).select("name").lean())?.name ?? "";
    return NextResponse.json({
      valid: true, type: c.type, number: c.number, issuedAt: c.issuedAt, holder: name ? maskName(name) : null, total: d.scores?.total ?? null,
      official: c.type === "itp", note: c.type === "itp" ? "Official score from the test organizer." : "A practice report from a simulation test, not an official TOEFL certificate.",
    });
  } catch (e) {
    return handleError(e);
  }
}
