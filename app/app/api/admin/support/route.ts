import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { CATEGORY } from "@/lib/support";
import { Ticket } from "@/models/Ticket";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Antrean tiket per tim (CS / Technical) dan status (8.4). Urgent dan yang menunggu balasan staf di atas. */
export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const team = sp.get("team") === "tech" ? "tech" : sp.get("team") === "cs" ? "cs" : null;
    const status = sp.get("status") || "open";
    const q = (sp.get("q") ?? "").trim().slice(0, 80);
    const filter: Record<string, unknown> = {};
    if (team) filter.team = team;
    if (status === "open") filter.status = { $ne: "resolved" };
    else if (["new", "in_progress", "waiting", "resolved"].includes(status)) filter.status = status;
    if (q) filter.$or = [{ name: new RegExp(esc(q), "i") }, { email: new RegExp(esc(q), "i") }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])];
    const [list, counts] = await Promise.all([
      Ticket.find(filter).sort({ urgent: -1, updatedAt: -1 }).limit(200).select("number name email category team status urgent messages lastUserAt lastStaffAt updatedAt createdAt").lean(),
      Ticket.aggregate<{ _id: { team: string; status: string }; n: number }>([{ $match: { status: { $ne: "resolved" } } }, { $group: { _id: { team: "$team", status: "$status" }, n: { $sum: 1 } } }]),
    ]);
    const open = { cs: 0, tech: 0, new: 0 };
    for (const c of counts) { open[c._id.team as "cs" | "tech"] += c.n; if (c._id.status === "new") open.new += c.n; }
    return NextResponse.json({
      open,
      tickets: list.map((t) => ({
        id: String(t._id), number: t.number, name: t.name, email: t.email, category: CATEGORY[t.category]?.label ?? t.category, team: t.team, status: t.status, urgent: !!t.urgent,
        preview: t.messages[t.messages.length - 1]?.body.slice(0, 120) ?? "", needsReply: !t.lastStaffAt || (!!t.lastUserAt && t.lastUserAt > t.lastStaffAt), updatedAt: t.updatedAt, createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
