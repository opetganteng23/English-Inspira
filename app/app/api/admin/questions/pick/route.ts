import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, CONTENT_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { Question, SECTIONS } from "@/models/Question";

const input = z.object({
  section: z.enum(SECTIONS),
  count: z.number().int().min(1).max(100),
  types: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  difficulties: z.array(z.enum(["easy", "medium", "hard"])).max(3).optional(),
  topics: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  excludeIds: z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(300).default([]),
});

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pilih soal terbit secara acak berdasarkan kriteria (jenis, tingkat kesulitan, topik) untuk Test Builder.
 * Soal yang berbagi passage/audio dipilih sebagai satu blok utuh, jadi bacaan atau rekaman tidak pernah terpotong; blok yang tidak muat dilewati.
 */
export async function POST(req: Request) {
  try {
    await requireRole(CONTENT_ROLES);
    const b = input.parse(await req.json());
    await connectDB();
    const filter: Record<string, unknown> = { section: b.section, status: "published", _id: { $nin: b.excludeIds } };
    if (b.types?.length) filter.type = { $in: b.types.map((t) => new RegExp(`^${esc(t)}$`, "i")) };
    if (b.difficulties?.length) filter.difficulty = { $in: b.difficulties };
    if (b.topics?.length) filter["tags.topic"] = { $in: b.topics.map((t) => new RegExp(`^${esc(t)}$`, "i")) };
    const pool = await Question.find(filter).select("groupId type difficulty stem").lean();
    // Kelompokkan: tiap grup satu blok, soal tanpa grup masing-masing satu blok; lalu acak blok.
    const blocks = new Map<string, typeof pool>();
    for (const q of pool) { const k = q.groupId ? `g:${q.groupId}` : `q:${q._id}`; (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(q); }
    const list = [...blocks.values()];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const chosen: typeof pool = [];
    for (const blk of list) { if (chosen.length + blk.length <= b.count) chosen.push(...blk); if (chosen.length >= b.count) break; }
    return NextResponse.json({ ids: chosen.map((q) => String(q._id)), available: pool.length, picked: chosen.length, short: chosen.length < b.count });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
