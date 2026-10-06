// Seed untuk database nyata (butuh MONGODB_URI). Jalankan: npm run seed
// Membuat: produk + voucher, tes free trial (soal CONTOH, ganti lewat Bank Soal), dan opsional data demo (--demo).
import { seedTrial } from "../lib/seed";
import { seedCommerce } from "../lib/seed-commerce";
import { seedDemo } from "../lib/seed-demo";
import mongoose from "mongoose";

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI wajib diisi untuk seed (taruh di .env.local lalu: npx tsx --env-file=.env.local scripts/seed.ts)");
  console.log("trial:", await seedTrial());
  console.log("commerce:", await seedCommerce());
  if (process.argv.includes("--demo")) console.log("demo:", await seedDemo());
  else console.log("(lewati data demo; tambahkan --demo untuk institusi/jadwal/materi contoh)");
  console.log("Selesai. Admin pertama: isi ADMIN_EMAILS lalu masuk dengan email itu.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
