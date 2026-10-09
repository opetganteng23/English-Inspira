// Seed untuk database nyata (butuh MONGODB_URI). Jalankan: npm run seed   (tambah --demo: institusi/akun/materi contoh)
// Membuat: level & parameter bawaan (dapat diubah admin), tes contoh (placement/sim/practice, SOAL CONTOH, ganti lewat Bank Soal).
import { seedTests } from "../lib/seed";
import { seedDemo } from "../lib/seed-demo";
import { getLevels } from "../lib/config";
import mongoose from "mongoose";

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI wajib diisi untuk seed (taruh di .env.local lalu: npm run seed)");
  console.log("levels:", (await getLevels()).map((l) => l.name).join(", "));
  console.log("tes:", await seedTests());
  if (process.argv.includes("--demo")) console.log("demo:", await seedDemo());
  else console.log("(lewati data demo; tambahkan --demo untuk institusi/akun/jadwal/materi contoh)");
  console.log("Selesai. Admin pertama: isi ADMIN_EMAILS lalu masuk dengan email itu.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
