import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Types } from "mongoose";
import { connectDB } from "./db";
import { enqueueMail } from "./mailq";
import { notify, notifyAdmins } from "./notify";
import { getSetting } from "@/models/Settings";
import { GENERAL_DEFAULTS } from "./public-info";
import { Ticket, TICKET_CATEGORIES, type TicketDoc } from "@/models/Ticket";

export const CATEGORY: Record<string, { label: string; team: "cs" | "tech"; urgent?: boolean }> = {
  account: { label: "Account or sign-in", team: "cs" },
  schedule: { label: "Test schedule", team: "cs" },
  during_test: { label: "Problem during the test", team: "tech", urgent: true },
  audio: { label: "Audio does not play", team: "tech", urgent: true },
  other: { label: "Something else", team: "cs" },
};
export const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", waiting: "Waiting for your reply", resolved: "Resolved" };
/** Tiket urgent yang belum dibalas selama ini: pengirim melihat tombol WhatsApp sebagai jalan terakhir (8.7). */
export const WA_AFTER_MIN = 15;

const APP = () => process.env.APP_URL ?? "http://localhost:3000";
export const ticketLink = (id: string, token?: string) => `${APP()}/support/${id}${token ? `?t=${token}` : ""}`;

export function tokenMatches(stored: string | undefined, given: string | null) {
  if (!stored || !given || stored.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(given));
}

async function nextNumber() {
  const last = await Ticket.findOne().sort({ number: -1 }).select("number").lean();
  return (last?.number ?? 1000) + 1;
}

export async function createTicket(x: { userId?: Types.ObjectId; role?: string; institutionId?: Types.ObjectId | null; name: string; email: string; category: (typeof TICKET_CATEGORIES)[number]; body: string; page?: string; userAgent?: string }) {
  await connectDB();
  const c = CATEGORY[x.category] ?? CATEGORY.other;
  const accessToken = randomBytes(24).toString("hex");
  let t: TicketDoc | null = null;
  for (let i = 0; i < 3 && !t; i++) {
    try {
      t = (await Ticket.create({ ...x, institutionId: x.institutionId ?? undefined, number: await nextNumber(), team: c.team, urgent: !!c.urgent, accessToken, messages: [{ from: "user", by: x.userId, byName: x.name, body: x.body }], lastUserAt: new Date() })).toObject();
    } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; } // nomor bentrok dengan tiket bersamaan: coba lagi
  }
  if (!t) throw new Error("Could not create the ticket, please try again");
  const id = String(t._id);
  await enqueueMail(x.email, "support_received", { number: t.number, category: c.label, link: ticketLink(id, x.userId ? undefined : accessToken) }, { priority: 3 });
  await notifyAdmins("support_new", { title: `${t.urgent ? "URGENT " : ""}Ticket #${t.number}: ${c.label}`, body: `${x.name}: ${x.body.slice(0, 120)}`, href: `/admin/support?id=${id}` });
  const g = await getSetting("general", GENERAL_DEFAULTS);
  if (g.supportEmail) await enqueueMail(g.supportEmail, "support_staff", { number: t.number, category: c.label, name: x.name, email: x.email, urgent: !!t.urgent, body: x.body.slice(0, 1500), link: `${APP()}/admin/support?id=${id}` }, { priority: t.urgent ? 2 : 5 });
  return { id, number: t.number, accessToken };
}

/** Balasan staf: tercatat, pengirim mendapat email dan notifikasi aplikasi (8.6). */
export async function staffReply(id: string, staff: { _id: Types.ObjectId; name?: string | null; email: string }, body: string) {
  const t = await Ticket.findById(id).select("+accessToken");
  if (!t) return null;
  t.messages.push({ from: "staff", by: staff._id, byName: staff.name || "Support", body, at: new Date() });
  t.lastStaffAt = new Date();
  if (t.status === "new" || t.status === "in_progress") t.status = "waiting";
  if (!t.assignedTo) t.assignedTo = staff._id;
  await t.save();
  await enqueueMail(t.email, "support_reply", { number: t.number, body: body.slice(0, 1500), link: ticketLink(id, t.userId ? undefined : t.accessToken) }, { priority: 3 });
  if (t.userId) await notify(t.userId, "support_reply", { title: `Reply to ticket #${t.number}`, body: body.slice(0, 120), href: `/support/${id}` });
  return t;
}
