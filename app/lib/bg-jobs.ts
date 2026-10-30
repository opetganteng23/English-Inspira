import mongoose, { Types } from "mongoose";
import { Readable } from "node:stream";
import { connectDB } from "./db";
import { collectTestRows, narrativeInput, buildTestExport } from "./test-export";
import { buildExecSummary } from "./exec-summary";
import { generateReportNarrative } from "./report-narrative";
import { aiEnabled, AI_MODEL } from "./ai";
import { Attempt, Test } from "@/models/Test";
import { Institution } from "@/models/Institution";
import { Job, type JobDoc } from "@/models/Job";

const KEEP_DAYS = 7;
const STALE_MS = 3 * 60_000; // tanpa detak selama ini = proses aplikasi berhenti di tengah jalan
// Perkiraan pemakaian per narasi (dari run AirNav Okt 2026, dibulatkan ke atas); biaya sebenarnya mengikuti harga model di Anthropic.
export const NARRATIVE_TOKENS = { in: 1800, out: 1100 };

async function bucket() {
  await connectDB();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "reports" });
}
export async function openReport(id: Types.ObjectId | string) {
  return (await bucket()).openDownloadStream(new Types.ObjectId(String(id)));
}

/** Peserta yang punya skor dan belum punya narasi AI untuk tes ini (cakupan institusi opsional). */
async function narrativeTodo(testId: string, institutionId?: string) {
  const got = await collectTestRows(testId, new Date(), undefined, { institutionId });
  if (!got) return null;
  const rows = got.rows.filter((r) => !r.qa && r.score != null && r.attemptId);
  const has = new Set((await Attempt.find({ _id: { $in: rows.map((r) => r.attemptId) }, "reportNarrative.engine": "claude" }).select("_id").lean()).map((a) => String(a._id)));
  return { rows, todo: rows.filter((r) => !has.has(r.attemptId)), has: has.size };
}

export async function estimateNarratives(testId: string, institutionId?: string) {
  const t = await narrativeTodo(testId, institutionId);
  if (!t) return null;
  return { scored: t.rows.length, already: t.has, todo: t.todo.length, ai: aiEnabled(), model: AI_MODEL(), tokensIn: t.todo.length * NARRATIVE_TOKENS.in, tokensOut: t.todo.length * NARRATIVE_TOKENS.out };
}

/** Daftar pekerjaan terbaru; sekaligus menandai yang terputus dan menghapus berkas lama. */
export async function listJobs(filter: { testId?: string } = {}) {
  await connectDB();
  await Job.updateMany({ status: "running", heartbeatAt: { $lt: new Date(Date.now() - STALE_MS) } }, { $set: { status: "failed", message: "Interrupted (the app restarted). Run it again; finished work is kept.", finishedAt: new Date() } });
  const old = await Job.find({ fileId: { $exists: true }, finishedAt: { $lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } }).select("fileId").lean();
  if (old.length) {
    const b = await bucket();
    for (const j of old) await b.delete(j.fileId!).catch(() => {});
    await Job.updateMany({ _id: { $in: old.map((j) => j._id) } }, { $unset: { fileId: 1 }, $set: { message: `File removed after ${KEEP_DAYS} days.` } });
  }
  return Job.find(filter.testId ? { testId: filter.testId } : {}).sort({ createdAt: -1 }).limit(30).lean();
}

export async function startJob(kind: JobDoc["kind"], testId: string, by: Types.ObjectId, institutionId?: string) {
  await connectDB();
  if (await Job.exists({ kind, testId, institutionId: institutionId ?? { $exists: false }, status: "running", heartbeatAt: { $gte: new Date(Date.now() - STALE_MS) } }))
    throw new Error("The same job is already running for this test.");
  const [t, inst] = await Promise.all([Test.findById(testId).select("name").lean(), institutionId ? Institution.findById(institutionId).select("name").lean() : null]);
  if (!t) throw new Error("Test not found");
  const job = await Job.create({ kind, testId, institutionId, label: inst ? `${t.name} · ${inst.name}` : t.name, createdBy: by, heartbeatAt: new Date() });
  void run(job._id, kind, testId, institutionId).catch(async (e) => {
    console.error("[jobs]", kind, (e as Error).message);
    await Job.updateOne({ _id: job._id }, { $set: { status: "failed", message: (e as Error).message.slice(0, 300), finishedAt: new Date() } });
  });
  return job;
}

async function run(id: Types.ObjectId, kind: JobDoc["kind"], testId: string, institutionId?: string) {
  const beat = (set: Record<string, unknown> = {}, inc: Record<string, number> = {}) =>
    Job.updateOne({ _id: id }, { $set: { heartbeatAt: new Date(), ...set }, ...(Object.keys(inc).length ? { $inc: inc } : {}) });
  const pulse = setInterval(() => void beat().catch(() => {}), 30_000);
  try {
    if (kind === "narratives") {
      const t = await narrativeTodo(testId, institutionId);
      if (!t) throw new Error("Test not found");
      const todo = [...t.todo];
      await beat({ total: todo.length });
      const worker = async () => {
        for (let r = todo.shift(); r; r = todo.shift()) {
          let tin = 0, tout = 0;
          const n = await generateReportNarrative(narrativeInput(r, 550), (a, b) => { tin += a; tout += b; });
          await Attempt.updateOne({ _id: r.attemptId }, { $set: { reportNarrative: n } });
          await beat({}, { done: 1, ai: n.engine === "claude" ? 1 : 0, tokensIn: tin, tokensOut: tout });
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      await beat({ status: "done", finishedAt: new Date(), message: "Narratives are used in the Excel results (Individual analysis) and reports." });
      return;
    }
    await beat({ total: 1 });
    const scope = { institutionId };
    const out = kind === "xlsx" ? await buildTestExport(testId, new Date(), undefined, scope) : await buildExecSummary(testId, { scope });
    if (!out) throw new Error("Test not found");
    const base = (out.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 90) || "test");
    const fileName = kind === "xlsx" ? `results-${base}.xlsx` : `executive-summary-${base}.pptx`;
    const up = (await bucket()).openUploadStream(fileName, { metadata: { jobId: id } });
    await new Promise<void>((resolve, reject) => { Readable.from(out.buffer as Buffer).pipe(up).on("finish", () => resolve()).on("error", reject); });
    await beat({ status: "done", done: 1, fileId: up.id, fileName, finishedAt: new Date() });
  } finally {
    clearInterval(pulse);
  }
}
