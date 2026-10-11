// Samakan level yang sudah ada dengan MTS v2.6 dan tabel skor TOEFL ITP:
//   Basic 310-459 (kuota 8), Intermediate 460-559 (kuota 6), Advanced 560-677 (kuota 4).
// Hanya mengubah nilai yang masih sama dengan bawaan lama, supaya perubahan manual admin tidak tertimpa.
// Jalankan: npx tsx scripts/align-levels.ts          (lihat saja)
//           npx tsx scripts/align-levels.ts --yes    (terapkan)
import mongoose from "mongoose";

type F = "coachingQuota" | "scoreMin" | "scoreMax";
const WANT: Record<string, Partial<Record<F, { from: number; to: number }>>> = {
  basic: { coachingQuota: { from: 8, to: 8 }, scoreMin: { from: 310, to: 310 }, scoreMax: { from: 459, to: 459 } },
  intermediate: { coachingQuota: { from: 4, to: 6 }, scoreMin: { from: 460, to: 460 }, scoreMax: { from: 542, to: 559 } },
  advanced: { coachingQuota: { from: 2, to: 4 }, scoreMin: { from: 543, to: 560 }, scoreMax: { from: 677, to: 677 } },
};

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const yes = process.argv.includes("--yes");
  await mongoose.connect(process.env.MONGODB_URI);
  const levels = mongoose.connection.db!.collection("levels");
  for (const l of await levels.find().sort({ order: 1 }).toArray()) {
    const w = WANT[String(l.key)];
    if (!w) { console.log(`${l.name}: skipped (custom level)`); continue; }
    const set: Record<string, number> = {};
    for (const [f, r] of Object.entries(w) as [F, { from: number; to: number }][]) {
      if (l[f] === r.to) continue;
      if (l[f] !== r.from) { console.log(`${l.name}.${f}: ${l[f]} was changed by an admin, left unchanged`); continue; }
      set[f] = r.to;
      console.log(`${l.name}.${f}: ${l[f]} -> ${r.to}${yes ? " (applied)" : " (dry run)"}`);
    }
    if (yes && Object.keys(set).length) await levels.updateOne({ _id: l._id }, { $set: set });
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
