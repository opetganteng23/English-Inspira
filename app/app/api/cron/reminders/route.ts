import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendWeeklyReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Dipanggil Vercel Cron (header Authorization: Bearer CRON_SECRET) atau penjadwal eksternal. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  return NextResponse.json(await sendWeeklyReminders());
}
