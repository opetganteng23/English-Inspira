// Kosongkan database untuk mulai bersih: SEMUA data dihapus kecuali
//   - akun staf pusat (admin, academic_admin, content_editor),
//   - konfigurasi sistem: levels, configparams, settings, scoringprofiles, questiontypes, counters,
//   - audit log (jejak tetap utuh),
//   - gambar yang dipakai pengaturan (logo/latar landing) dan foto profil staf.
// Yang terhapus: peserta, coach, admin institusi, institusi, undangan, soal, grup soal, audio, materi, tes, course,
// unit, attempt, analisis, kelas, hasil PURE/OCE, periode, jadwal ITP, dan semua berkas audio/PDF.
// Default hanya MENAMPILKAN (dry run). Untuk menghapus: npx tsx scripts/reset-all.ts --yes
// Wajib backup dulu: mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)
import mongoose from "mongoose";

const YES = process.argv.includes("--yes");
const STAFF = ["admin", "academic_admin", "content_editor"];
const KEEP = new Set(["levels", "configparams", "settings", "scoringprofiles", "questiontypes", "counters", "auditlogs"]);

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  console.log(`Database: ${db.databaseName} (${uri.replace(/\/\/[^@]*@/, "//***@")})\nMode: ${YES ? "DELETE" : "dry run (add --yes to delete)"}\n`);

  const staff = await db.collection("users").find({ role: { $in: STAFF } }).project({ _id: 1, email: 1, role: 1, avatarAssetId: 1 }).toArray();
  console.log(`Accounts kept: ${staff.map((u) => `${u.email} (${u.role})`).join(", ") || "none"}`);
  if (!staff.some((u) => u.role === "admin")) throw new Error("No admin account found. Refusing to continue.");

  // Gambar yang tetap disimpan: dipakai pengaturan (landing) atau foto profil staf.
  const settingsJson = JSON.stringify(await db.collection("settings").find().toArray());
  const keepAssets = new Set<string>(staff.flatMap((u) => (u.avatarAssetId ? [String(u.avatarAssetId)] : [])));
  for (const m of settingsJson.matchAll(/[0-9a-f]{24}/g)) keepAssets.add(m[0]);

  let total = 0;
  for (const c of (await db.listCollections().toArray()).map((x) => x.name).sort()) {
    if (KEEP.has(c) || c.startsWith("system.")) continue;
    const col = db.collection(c);
    const filter: Record<string, unknown> =
      c === "users" ? { role: { $nin: STAFF } } :
      c === "assets" ? { _id: { $nin: [...keepAssets].filter((id) => /^[0-9a-f]{24}$/.test(id)).map((id) => new mongoose.Types.ObjectId(id)) } } : {};
    const n = await col.countDocuments(filter);
    if (!n) continue;
    total += n;
    console.log(`${c.padEnd(26)} ${String(n).padStart(7)}${YES ? "  deleted" : ""}`);
    if (YES) await col.deleteMany(filter);
  }
  if (YES) {
    // Staf yang tersisa: lepaskan tautan ke data yang sudah tidak ada.
    await db.collection("users").updateMany({ role: { $in: STAFF } }, { $unset: { institutionId: 1, currentLevelId: 1, currentScoreEst: 1, placementAttemptId: 1, placementCycleId: 1, placementSource: 1 } });
  }
  console.log(`\n${YES ? "Deleted" : "Would delete"} ${total} documents. Kept: staff accounts, ${[...KEEP].join(", ")}.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
