import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { CoachSlot } from "@/models/Coaching";

// Hanya untuk uji otomatis di dev (memajukan slot ke masa lalu agar kehadiran bisa dicatat). Mati total di production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const { slotId, startedMinutesAgo } = z.object({ slotId: z.string(), startedMinutesAgo: z.number().min(1).max(600) }).parse(await req.json());
  await connectDB();
  const startsAt = new Date(Date.now() - startedMinutesAgo * 60_000);
  await CoachSlot.updateOne({ _id: slotId }, { startsAt, endsAt: new Date(+startsAt + 3_600_000) });
  return NextResponse.json({ ok: true });
}
