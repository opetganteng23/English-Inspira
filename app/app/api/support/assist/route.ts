import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";
import { handleError, HttpError } from "@/lib/rbac";
import { limit, clientIp } from "@/lib/ratelimit";
import { matchFaq, aiAssist, ASSIST_MAX_TURNS } from "@/lib/support-ai";
import { TICKET_CATEGORIES } from "@/models/Ticket";

export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) })).min(1).max(ASSIST_MAX_TURNS * 2),
  useAi: z.boolean().optional(), // false = hanya FAQ (langkah pertama, tanpa biaya)
});

/** Saklar bantuan sebelum tiket (8.8). Mati: form langsung mengirim tiket. Bisa dibaca tanpa login (form di sign-in). */
export async function GET() {
  return NextResponse.json({ enabled: !!(await getFeatures()).aiSupport, maxTurns: ASSIST_MAX_TURNS });
}

export async function POST(req: Request) {
  try {
    if (!(await getFeatures()).aiSupport) throw new HttpError(404, "This feature is not available");
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Check the form");
    const h = p.data.history;
    if (h[h.length - 1].role !== "user") throw new HttpError(400, "Ask a question first");
    if (h.filter((m) => m.role === "user").length > ASSIST_MAX_TURNS) return NextResponse.json({ faq: [], answer: "", needsHuman: true });
    const user = await getCurrentUser();
    await limit("supportAssist", clientIp(req));
    const faq = matchFaq(h.filter((m) => m.role === "user").map((m) => m.content).join(" "), user?.role);
    if (!p.data.useAi) return NextResponse.json({ faq, answer: "", needsHuman: false });
    const r = await aiAssist(p.data.category, h, user?.role);
    return NextResponse.json({ faq, ...r });
  } catch (e) {
    return handleError(e);
  }
}
