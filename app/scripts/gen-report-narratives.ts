// Tulis narasi laporan per peserta (bahasa Indonesia, AI) untuk satu tes, lalu simpan di attempt.reportNarrative.
// Excel hasil tes (sheet "Individual analysis") memakainya. Yang sudah punya narasi dilewati, jadi aman dijalankan ulang.
// Jalankan: node --env-file=.env.local node_modules/.bin/tsx scripts/gen-report-narratives.ts <testId> [from] [to] [--limit=N] [--target=550]
import { connectDB } from "@/lib/db";
import { collectTestRows, narrativeInput } from "@/lib/test-export";
import { generateReportNarrative } from "@/lib/report-narrative";
import { Attempt } from "@/models/Test";

(async () => {
  const args = process.argv.slice(2);
  const [testId, from, to] = args.filter((a) => !a.startsWith("--"));
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const limit = Number(opt("limit")) || Infinity, target = Number(opt("target")) || 550;
  if (!testId) throw new Error("testId wajib");
  await connectDB();
  const got = await collectTestRows(testId, new Date(), undefined, { from, to });
  if (!got) throw new Error("Tes tidak ditemukan");
  const rows = got.rows.filter((r) => !r.qa && r.score != null && r.attemptId);
  const has = new Set((await Attempt.find({ _id: { $in: rows.map((r) => r.attemptId) }, "reportNarrative.engine": "claude" }).select("_id").lean()).map((a) => String(a._id)));
  const todo = rows.filter((r) => !has.has(r.attemptId)).slice(0, limit);
  console.log(`peserta ${rows.length}, sudah ada ${has.size}, dikerjakan ${todo.length}`);
  let done = 0, ai = 0;
  const worker = async () => {
    for (let r = todo.shift(); r; r = todo.shift()) {
      const n = await generateReportNarrative(narrativeInput(r, target));
      await Attempt.updateOne({ _id: r.attemptId }, { $set: { reportNarrative: n } });
      done++; if (n.engine === "claude") ai++;
      if (done % 25 === 0) console.log(`${done} selesai (AI ${ai})`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`selesai ${done} (AI ${ai}, template ${done - ai})`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
