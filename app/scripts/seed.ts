// Seed untuk database nyata (butuh MONGODB_URI). Jalankan: npm run seed   (tambah --demo: institusi/akun/materi contoh)
// Membuat: level & parameter bawaan (dapat diubah admin), tes contoh (placement/sim/practice, SOAL CONTOH, ganti lewat Bank Soal).
import { seedTests } from "../lib/seed";
import { seedDemo } from "../lib/seed-demo";
import { getLevels } from "../lib/config";
import mongoose from "mongoose";

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for seeding (put it in .env.local, then: npm run seed)");
  console.log("levels:", (await getLevels()).map((l) => l.name).join(", "));
  console.log("tests:", await seedTests());
  if (process.argv.includes("--demo")) console.log("demo:", await seedDemo());
  else console.log("(skipping demo data; add --demo for sample institutions/accounts/schedules/materials)");
  console.log("Done. First admin: set ADMIN_EMAILS, then sign in with that email.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
