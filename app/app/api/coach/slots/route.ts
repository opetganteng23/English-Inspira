import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { createSlot } from "@/lib/coaching";
import { slotInput } from "@/lib/coaching-schemas";
import { getLevels } from "@/lib/config";
import { CoachSlot } from "@/models/Coaching";

export const dynamic = "force-dynamic";

/** Slot milik coach (admin melihat semua). */
export async function GET() {
  try {
    const me = await requireRole(["coach", "admin"]);
    await connectDB();
    const [slots, levels] = await Promise.all([
      CoachSlot.find(me.role === "admin" ? {} : { coachId: me._id }).sort({ startsAt: -1 }).limit(200).lean(),
      getLevels(),
    ]);
    return NextResponse.json({
      levels: levels.map((l) => ({ id: String(l._id), name: l.name })),
      slots: slots.map((s) => ({
        id: String(s._id), title: s.title ?? "", startsAt: s.startsAt, endsAt: s.endsAt, mode: s.mode, meetingUrl: s.meetingUrl ?? "", room: s.room ?? "",
        capacity: s.capacity, booked: s.booked, status: s.status, levelId: s.levelId ? String(s.levelId) : null, cancelReason: s.cancelReason ?? null,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(["coach"]);
    const b = slotInput.parse(await req.json());
    const s = await createSlot(me, b);
    return NextResponse.json({ id: String(s._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
