import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { loadAttempt, sectionDeadline } from "@/lib/attempts";
import { Question, QuestionGroup } from "@/models/Question";

const ROLES = ["participant", "admin", "inst_admin"] as const;

/** State tes: hanya soal section aktif, tanpa kunci jawaban. Sisa waktu dihitung server. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole([...ROLES]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status === "submitted") return NextResponse.json({ status: "submitted" });

    const section = test.sections[attempt.sectionIdx];
    await connectDB();
    const qs = await Question.find({ _id: { $in: section.questionIds } })
      .select("-answerKey -explanation -tags -status").lean();
    const order = new Map(section.questionIds.map((id, i) => [String(id), i]));
    qs.sort((a, b) => order.get(String(a._id))! - order.get(String(b._id))!);

    const groups = await QuestionGroup.find({ _id: { $in: qs.map((q) => q.groupId).filter((g): g is NonNullable<typeof g> => !!g) } }).lean();
    const played = new Map(attempt.audioPlays.map((p) => [String(p.audioId), p]));

    return NextResponse.json({
      status: "in_progress",
      testName: test.name,
      section: { index: attempt.sectionIdx, total: test.sections.length, name: section.name },
      kind: attempt.kind,
      idleTimeoutSec: await getParam("idle_timeout_sec"),
      remainingSec: Math.max(0, Math.round((sectionDeadline(attempt, test) - Date.now()) / 1000)),
      groups: groups.map((g) => ({
        id: String(g._id), instruction: g.instruction, passageTitle: g.passageTitle, passageHtml: g.passageHtml,
        audio: g.audioId ? { id: String(g.audioId), finished: !!played.get(String(g.audioId))?.done } : null,
      })),
      questions: qs.map((q) => ({
        id: String(q._id), groupId: q.groupId ? String(q.groupId) : null, stem: q.stem, options: q.options,
        assetIds: q.assetIds.map(String),
      })),
      answers: attempt.answers.map((a) => ({ qid: String(a.qid), choice: a.choice, flagged: !!a.flagged, timeSpentSec: a.timeSpentSec ?? 0 })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  answers: z.array(z.object({
    qid: z.string(), choice: z.number().int().min(0).max(5).nullable(),
    timeSpentSec: z.number().min(0).max(3600).optional(), flagged: z.boolean().optional(),
  })).max(200).optional(),
  flags: z.array(z.enum(["tab_hidden", "fullscreen_exit", "paste", "multi_tab"])).max(20).optional(),
});

/** Autosave. Hanya soal section aktif yang diterima, dan hanya sebelum waktu habis. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole([...ROLES]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "in_progress") throw new HttpError(409, "Time is up or the test is already finished");
    const body = patchSchema.parse(await req.json());

    const allowed = new Set(test.sections[attempt.sectionIdx].questionIds.map(String));
    for (const a of body.answers ?? []) {
      if (!allowed.has(a.qid)) continue; // soal section lain diabaikan
      const cur = attempt.answers.find((x) => String(x.qid) === a.qid);
      const choice = a.choice ?? undefined;
      // firstChoice & changes dihitung SERVER (tidak dipercaya dari klien): indikator ragu-ragu untuk analisis (MTS §11).
      const firstChoice = cur?.firstChoice ?? choice;
      const changed = cur?.choice != null && choice != null && cur.choice !== choice;
      const next = { qid: a.qid, choice, firstChoice, changes: (cur?.changes ?? 0) + (changed ? 1 : 0), timeSpentSec: a.timeSpentSec ?? cur?.timeSpentSec, flagged: a.flagged ?? cur?.flagged };
      if (cur) Object.assign(cur, next);
      else attempt.answers.push(next as never);
    }
    const now = new Date();
    for (const kind of body.flags ?? []) attempt.proctorFlags.push({ kind, at: now } as never);
    await attempt.save();
    return NextResponse.json({ ok: true, savedAt: now });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}
