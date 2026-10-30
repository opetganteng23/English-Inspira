import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handleError, HttpError } from "@/lib/rbac";
import { limit } from "@/lib/ratelimit";
import { notifyAdmins } from "@/lib/notify";
import { CATEGORY, STATUS_LABEL, WA_AFTER_MIN, tokenMatches } from "@/lib/support";
import { getSetting } from "@/models/Settings";
import { GENERAL_DEFAULTS } from "@/lib/public-info";
import { Ticket } from "@/models/Ticket";

export const dynamic = "force-dynamic";

/** Pengirim boleh membuka tiketnya: login sebagai pemilik (atau email sama), atau membawa token dari email. */
async function load(req: Request, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Request not found");
  await connectDB();
  const t = await Ticket.findById(id).select("+accessToken");
  if (!t) throw new HttpError(404, "Request not found");
  const user = await getCurrentUser();
  const own = user && ((t.userId && String(t.userId) === String(user._id)) || t.email === user.email.toLowerCase());
  if (!own && !tokenMatches(t.accessToken, new URL(req.url).searchParams.get("t"))) throw new HttpError(404, "Request not found");
  return t;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const t = await load(req, params.id);
    // WhatsApp hanya jalan terakhir (8.7): tiket urgent, belum dibalas staf, sudah menunggu WA_AFTER_MIN menit.
    const waiting = t.urgent && !t.lastStaffAt && t.status !== "resolved" && Date.now() - +t.createdAt! > WA_AFTER_MIN * 60_000;
    const wa = waiting ? (await getSetting("general", GENERAL_DEFAULTS)).supportWhatsapp || null : null;
    return NextResponse.json({
      id: String(t._id), number: t.number, category: CATEGORY[t.category]?.label ?? t.category, status: t.status, statusLabel: STATUS_LABEL[t.status], urgent: !!t.urgent,
      name: t.name, email: t.email, createdAt: t.createdAt,
      messages: t.messages.filter((m) => m.from !== "system").map((m) => ({ from: m.from, byName: m.from === "staff" ? m.byName || "Support" : m.byName, body: m.body, at: m.at })),
      whatsapp: wa ? { number: wa.replace(/\D/g, "").replace(/^0/, "62"), afterMin: WA_AFTER_MIN } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Balasan pengirim. Tiket yang sudah Resolved dibuka lagi. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const t = await load(req, params.id);
    const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(await req.json());
    await limit("supportReply", String(t._id));
    t.messages.push({ from: "user", byName: t.name, body, at: new Date() });
    t.lastUserAt = new Date();
    if (t.status === "waiting" || t.status === "resolved") t.status = t.status === "resolved" ? "new" : "in_progress";
    await t.save();
    await notifyAdmins("support_reply_in", { title: `New reply on ticket #${t.number}`, body: body.slice(0, 120), href: `/admin/support?id=${t._id}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
    return handleError(e);
  }
}
