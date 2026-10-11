import { NextResponse } from "next/server";
import { z } from "zod";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { audit } from "@/lib/audit";
import { aiEnabled } from "@/lib/ai";
import { generateInput, generateQuestionDrafts, stemKey } from "@/lib/ai-questions";
import { Question } from "@/models/Question";

export const dynamic = "force-dynamic";
const limiter = new RateLimiterMemory({ points: 10, duration: 600 }); // 10 permintaan per 10 menit per akun (biaya AI)

/** Status fitur untuk UI: apakah AI aktif di server ini. */
export async function GET() {
  try {
    await requireRole(CONTENT_ROLES);
    return NextResponse.json({ enabled: aiEnabled() });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Draf soal dari Claude. Tidak menyimpan apa pun: admin meninjau lalu menyimpan yang dipilih lewat POST /api/admin/questions
 * sebagai `draft` bersumber "AI draft". Soal yang sama persis dengan yang ada di bank ditandai duplikat.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole(CONTENT_ROLES);
    if (!aiEnabled()) throw new HttpError(503, "AI is not configured on this server. Ask the administrator to set the API key.");
    try { await limiter.consume(String(user._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Too many AI requests. Please wait a few minutes."); throw e; }
    const b = generateInput.parse(await req.json());
    await connectDB();
    const existing = await Question.find({ section: b.section, "tags.topic": b.topic }).select("stem").limit(500).lean();
    const out = await generateQuestionDrafts(b, new Set(existing.map((q) => stemKey(q.stem))));
    await audit(user._id, "questions.ai_generate", b.topic, { count: b.count, got: out.drafts.length, dropped: out.dropped, tokens: out.tokensIn + out.tokensOut });
    return NextResponse.json({ drafts: out.drafts, dropped: out.dropped, truncated: out.truncated });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    if (e instanceof Error && !(e instanceof HttpError)) { console.error(e); return NextResponse.json({ error: "The AI request failed. Try again in a moment." }, { status: 502 }); }
    return handleError(e);
  }
}
