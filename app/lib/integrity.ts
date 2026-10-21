import { connectDB } from "./db";
import { buildActivity } from "./activity";
import { Attempt } from "@/models/Test";

/**
 * Pemeriksaan otomatis "soal kosong terselip": soal kosong tanpa jejak simpanan sama sekali, diapit soal yang terjawab
 * (urutan tampil peserta). Pola ini muncul bila jawaban hilang di jalan (koneksi), atau peserta menekan Next tanpa memilih.
 * Hasil disimpan di attempt.integrity dan ditampilkan di Review Proctoring.
 */
export async function checkIntegrity(attemptId: string) {
  const a = await Attempt.findById(attemptId).select("answers").lean();
  if (!a) return null;
  const has = new Set(a.answers.map((x) => String(x.qid)));
  const act = await buildActivity(attemptId);
  const where: string[] = [];
  const lockedStart: { section: string; n: number }[] = [];
  for (const s of act.sections) {
    s.questions.forEach((q, i) => {
      if (!q.answered && !has.has(q.qid) && s.questions[i - 1]?.answered && s.questions[i + 1]?.answered) where.push(`${s.name[0].toUpperCase()}${q.no}`);
    });
    // Bagian yang "mulai di tengah": blok soal awal tanpa jejak sama sekali lalu soal sesudahnya dijawab (posisi dari bagian sebelumnya terbawa).
    let lead = 0; while (lead < s.questions.length && !has.has(s.questions[lead].qid)) lead++;
    if (lead >= 3 && s.questions.slice(lead).some((q) => q.answered)) lockedStart.push({ section: s.name, n: lead });
  }
  await Attempt.updateOne({ _id: attemptId }, { $set: { integrity: { isolatedBlanks: where.length, where, lockedStart, checkedAt: new Date() } } });
  return where;
}

/** Tiap jam: periksa tes yang selesai (≥10 menit lalu, 14 hari terakhir) dan belum diperiksa. */
export async function scanIntegrity(limit = 300) {
  await connectDB();
  const list = await Attempt.find({ status: "submitted", "integrity.checkedAt": { $exists: false }, kind: { $in: ["placement", "sim", "final"] }, finishedAt: { $gte: new Date(Date.now() - 14 * 86_400_000), $lte: new Date(Date.now() - 10 * 60_000) } }).select("_id").limit(limit).lean();
  let found = 0;
  for (const a of list) { const w = await checkIntegrity(String(a._id)).catch(() => null); if (w?.length) found++; }
  return { checked: list.length, found };
}
