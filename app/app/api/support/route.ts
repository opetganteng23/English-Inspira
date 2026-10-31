import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { limit, clientIp } from "@/lib/ratelimit";
import { createTicket, STATUS_LABEL, CATEGORY } from "@/lib/support";
import { transcript } from "@/lib/support-ai";
import { Ticket, TICKET_CATEGORIES } from "@/models/Ticket";

export const dynamic = "force-dynamic";

/** Tiket milik pengguna yang login (My tickets). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Sign in first");
    await connectDB();
    const list = await Ticket.find({ $or: [{ userId: user._id }, { email: user.email.toLowerCase() }] }).sort({ updatedAt: -1 }).limit(50).select("number category status urgent messages updatedAt createdAt lastStaffAt lastUserAt").lean();
    return NextResponse.json({
      tickets: list.map((t) => ({
        id: String(t._id), number: t.number, category: CATEGORY[t.category]?.label ?? t.category, status: t.status, statusLabel: STATUS_LABEL[t.status], urgent: !!t.urgent,
        preview: t.messages[t.messages.length - 1]?.body.slice(0, 140) ?? "", unread: !!t.lastStaffAt && (!t.lastUserAt || t.lastStaffAt > t.lastUserAt), updatedAt: t.updatedAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  category: z.enum(TICKET_CATEGORIES),
  body: z.string().trim().min(10, "Describe the problem in a few words (at least 10 characters)").max(4000),
  page: z.string().max(300).optional(),
  website: z.string().max(0).optional(), // perangkap bot: kolom tersembunyi, harus kosong
  assist: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12).optional(), // percakapan AI sebelum tiket (8.8)
});

/** Kirim tiket. Nama, email, dan kendala wajib (8.2). Bisa tanpa login (dari halaman sign-in); dibatasi per IP dan per email. */
export async function POST(req: Request) {
  try {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Check the form");
    const user = await getCurrentUser();
    await limit("supportIp", clientIp(req));
    await limit("supportEmail", (user?.email ?? p.data.email).toLowerCase());
    const t = await createTicket({
      userId: user?._id, role: user?.role, institutionId: user?.institutionId ?? null,
      name: user?.name || p.data.name, email: user?.email ?? p.data.email.toLowerCase(),
      category: p.data.category, body: p.data.body, page: p.data.page, assist: p.data.assist?.length ? transcript(p.data.assist) : undefined, userAgent: req.headers.get("user-agent")?.slice(0, 300),
    });
    return NextResponse.json({ id: t.id, number: t.number, token: user ? null : t.accessToken }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
