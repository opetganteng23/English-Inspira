import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { User } from "@/models/User";
import { composeName } from "@/lib/person-name";

const schema = z.object({
  consent: z.literal(true, { message: "Agree to the use of your data to continue" }),
  givenName: z.string().trim().min(1, "Enter your given name").max(60),
  surname: z.string().trim().min(1, "Enter your surname").max(60),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Invalid phone number").optional().or(z.literal("")),
});

/** Login pertama: lengkapi profil + persetujuan data (UU PDP). Status invited → active. */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant", "coach", "inst_admin"], { allowInvited: true });
    const b = schema.parse(await req.json());
    await connectDB();
    await User.updateOne({ _id: me._id }, { name: composeName(b.givenName, b.surname), givenName: b.givenName, surname: b.surname, ...(b.phone ? { phone: b.phone } : {}), consentAt: me.consentAt ?? new Date(), status: "active" });
    await audit(me._id, "consent.accept", String(me._id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
