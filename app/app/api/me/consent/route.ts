import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";

const schema = z.object({
  consent: z.literal(true, { message: "Setujui penggunaan data untuk melanjutkan" }),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Nomor telepon tidak valid").optional().or(z.literal("")),
});

/** Login pertama: lengkapi profil + persetujuan data (UU PDP). Status invited → active. */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant", "coach", "inst_admin"], { allowInvited: true });
    const b = schema.parse(await req.json());
    await connectDB();
    await User.updateOne({ _id: me._id }, { name: b.name, ...(b.phone ? { phone: b.phone } : {}), consentAt: me.consentAt ?? new Date(), status: "active" });
    await audit(me._id, "consent.accept", String(me._id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
