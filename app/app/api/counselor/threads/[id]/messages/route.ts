import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { counselorAccess } from "@/lib/entitlements";
import { buildCounselorContext } from "@/lib/analysis";
import { counselorReply, detectDistress, DISTRESS_NOTICE } from "@/lib/ai";
import { CounselorThread } from "@/models/Counselor";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const perMinute = new RateLimiterMemory({ points: 6, duration: 60 });
const schema = z.object({ content: z.string().trim().min(1, "Tulis pertanyaanmu").max(1500, "Maksimal 1500 karakter") });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin", "inst_admin"]);
    const { content } = schema.parse(await req.json());
    try { await perMinute.consume(String(user._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Terlalu cepat, tunggu sebentar."); throw e; }
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Percakapan tidak ditemukan");
    await connectDB();
    const thread = await CounselorThread.findOne({ _id: params.id, userId: user._id });
    if (!thread) throw new HttpError(404, "Percakapan tidak ditemukan");

    // Kuota dicek dari entitlement/jatah gratis, bukan dari klien.
    const access = await counselorAccess(user._id);
    if (!access.allowed) throw new HttpError(402, access.reason ?? "Akses Konselor AI belum terbuka");

    const now = new Date();
    thread.messages.push({ role: "user", content, at: now } as never);

    // Tanda stres berat: tampilkan info bantuan profesional, tandai untuk admin, tanpa memanggil AI.
    if (detectDistress(content)) {
      thread.messages.push({ role: "assistant", content: DISTRESS_NOTICE, at: new Date() } as never);
      thread.flagged = true; thread.reviewed = false;
      await thread.save();
      return NextResponse.json({ reply: DISTRESS_NOTICE, actionPlan: [], access: await counselorAccess(user._id) });
    }

    const history = thread.messages.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));
    const ctx = await buildCounselorContext(user._id);
    const { result, mock } = await counselorReply(ctx, history, content);

    thread.messages.push({ role: "assistant", content: result.reply, at: new Date(), mock } as never);
    const existing = new Set(thread.actionPlan.map((p) => (p.text ?? "").toLowerCase()));
    for (const item of result.actionPlan ?? []) {
      if (existing.has(item.text.toLowerCase())) continue;
      thread.actionPlan.push({ text: item.text, done: false, dueAt: item.dueInDays ? new Date(Date.now() + item.dueInDays * 86_400_000) : undefined } as never);
    }
    if (thread.title === "Percakapan baru") thread.title = content.slice(0, 40);
    await thread.save();
    return NextResponse.json({
      reply: result.reply, mock,
      actionPlan: thread.actionPlan.map((p) => ({ id: String(p._id), text: p.text, done: p.done, dueAt: p.dueAt ?? null })),
      access: await counselorAccess(user._id),
    });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Input tidak valid" }, { status: 400 });
    return handleError(e);
  }
}
