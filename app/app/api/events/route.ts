import { NextResponse } from "next/server";
import { z } from "zod";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { eventInput } from "@/lib/course-schemas";
import { LearningEvent } from "@/models/Course";

const limiter = new RateLimiterMemory({ points: 8, duration: 60 }); // heartbeat normal ±4/menit
const MAX_PER_BEAT = 30;

/** Hari kalender WIB (UTC+7) sebagai YYYY-MM-DD. */
const dayWib = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/**
 * Heartbeat waktu belajar aktif (MTS §13.1). Klien hanya mengirim saat tab terlihat dan pengguna aktif;
 * server membatasi tiap detak (30 dtk) dan frekuensinya, sehingga waktu tidak bisa digelembungkan.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(["participant"]);
    try { await limiter.consume(String(me._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Too many requests"); throw e; }
    const b = eventInput.parse(await req.json());
    await connectDB();
    const sec = Math.min(MAX_PER_BEAT, Math.max(0, Math.round(b.activeSec)));
    if (sec > 0)
      await LearningEvent.updateOne(
        { userId: me._id, kind: b.kind, refId: b.refId, day: dayWib() },
        { $inc: { activeSec: sec }, $setOnInsert: { ...(me.institutionId ? { institutionId: me.institutionId } : {}) } },
        { upsert: true }
      );
    return NextResponse.json({ ok: true, idleTimeoutSec: await getParam("idle_timeout_sec") });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
