import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { limit, clientIp } from "@/lib/ratelimit";
import { handleError } from "@/lib/rbac";
import { Lead } from "@/models/Material";

const schema = z.object({ email: z.email().max(200), source: z.string().max(40).optional() });

/** Tangkap email dari landing page. Respons selalu sama (tidak membocorkan apakah email sudah ada). */
export async function POST(req: Request) {
  try {
    await limit("otpIp", clientIp(req));
    const b = schema.parse(await req.json());
    await connectDB();
    await Lead.updateOne({ email: b.email.toLowerCase() }, { $setOnInsert: { email: b.email.toLowerCase(), source: b.source ?? "landing" } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
