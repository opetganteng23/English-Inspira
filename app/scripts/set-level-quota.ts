// Samakan kuota coaching level yang sudah ada dengan MTS v2.6 (Basic 8, Intermediate 6, Advanced 4).
// Hanya menyentuh level yang kuotanya masih nilai lama bawaan (8/4/2/...), supaya perubahan manual admin tidak tertimpa.
// Jalankan: npx tsx scripts/set-level-quota.ts            (lihat saja)
//           npx tsx scripts/set-level-quota.ts --yes      (terapkan)
import mongoose from "mongoose";

const WANT: Record<string, { from: number; to: number }> = { basic: { from: 8, to: 8 }, intermediate: { from: 4, to: 6 }, advanced: { from: 2, to: 4 } };

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const levels = mongoose.connection.db!.collection("levels");
  for (const l of await levels.find().toArray()) {
    const w = WANT[String(l.key)];
    if (!w) { console.log(`${l.name}: skipped (custom level)`); continue; }
    if (l.coachingQuota === w.to) { console.log(`${l.name}: already ${w.to}`); continue; }
    if (l.coachingQuota !== w.from) { console.log(`${l.name}: ${l.coachingQuota} was set by an admin, left unchanged`); continue; }
    console.log(`${l.name}: ${l.coachingQuota} -> ${w.to}${process.argv.includes("--yes") ? " (applied)" : " (dry run)"}`);
    if (process.argv.includes("--yes")) await levels.updateOne({ _id: l._id }, { $set: { coachingQuota: w.to } });
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
