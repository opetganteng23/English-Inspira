import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { JOBS, type JobName } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Dipanggil cron sistem / Vercel Cron dengan header Authorization: Bearer CRON_SECRET. Job: mail | hourly | daily. */
export async function GET(req: Request, { params }: { params: { job: string } }) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const job = JOBS[params.job as JobName];
  if (!job) return NextResponse.json({ error: "Job tidak dikenal" }, { status: 404 });
  return NextResponse.json(await job());
}
