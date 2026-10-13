// Naikkan kuota coaching bawaan sesuai notulensi 11/10/2026: Basic 12, Intermediate 8, Advanced 4 (dari 8/6/4).
// Hanya mengubah nilai yang masih sama dengan bawaan lama, supaya perubahan manual admin tidak tertimpa.
// Jalankan: npx tsx scripts/align-quota-2026-10.ts          (lihat saja)
//           npx tsx scripts/align-quota-2026-10.ts --yes    (terapkan)
import mongoose from "mongoose";

const WANT: Record<string, { from: number; to: number }> = {
  basic: { from: 8, to: 12 },
  intermediate: { from: 6, to: 8 },
  advanced: { from: 4, to: 4 },
};

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const yes = process.argv.includes("--yes");
  await mongoose.connect(process.env.MONGODB_URI);
  const levels = mongoose.connection.db!.collection("levels");
  for (const l of await levels.find().sort({ order: 1 }).toArray()) {
    const w = WANT[String(l.key)];
    if (!w) { console.log(`${l.name}: skipped (custom level)`); continue; }
    if (l.coachingQuota === w.to) { console.log(`${l.name}.coachingQuota: already ${w.to}`); continue; }
    if (l.coachingQuota !== w.from) { console.log(`${l.name}.coachingQuota: ${l.coachingQuota} was changed by an admin, left unchanged`); continue; }
    console.log(`${l.name}.coachingQuota: ${l.coachingQuota} -> ${w.to}${yes ? " (applied)" : " (dry run)"}`);
    if (yes) await levels.updateOne({ _id: l._id }, { $set: { coachingQuota: w.to } });
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
