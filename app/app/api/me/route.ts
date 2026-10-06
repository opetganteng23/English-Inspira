import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { User } from "@/models/User";
import { Institution } from "@/models/Institution";
import { ItpRegistration } from "@/models/Itp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
    const inst = u.institutionId ? await Institution.findById(u.institutionId).select("name code").lean() : null;
    const nameLocked = !!(await ItpRegistration.exists({ userId: u._id, status: { $ne: "cancelled" } }));
    return NextResponse.json({
      id: String(u._id), email: u.email, name: u.name ?? null, role: u.role, phone: u.phone ?? null,
      education: u.education ?? null, targetScore: u.targetScore ?? null, goal: u.goal ?? null,
      institutionId: u.institutionId ? String(u.institutionId) : null, institution: inst ? { name: inst.name } : null,
      consentAt: u.consentAt ?? null, createdAt: u.createdAt, nameLocked,
      onboarded: !!(u.name && u.targetScore && u.goal),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patch = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Nomor WhatsApp tidak valid").optional(),
  education: z.enum(["sma", "d3", "s1", "s2"]).optional(),
  targetScore: z.union([z.literal(450), z.literal(500), z.literal(550), z.literal(600)]).optional(),
  goal: z.enum(["kelulusan", "beasiswa", "pekerjaan", "lainnya"]).optional(),
  consent: z.literal(true).optional(),
});

export async function PATCH(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, "Belum masuk");
    const b = patch.parse(await req.json());
    await connectDB();
    const u = await User.findById(me._id);
    if (!u) throw new HttpError(401, "Belum masuk");
    if (b.name && b.name !== u.name && (await ItpRegistration.exists({ userId: u._id, status: { $ne: "cancelled" } })))
      throw new HttpError(409, "Nama terkunci setelah mendaftar tes ITP resmi");
    const { consent, ...rest } = b;
    u.set(rest);
    if (consent && !u.consentAt) u.consentAt = new Date();
    await u.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
