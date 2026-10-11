// Kosongkan semua peserta beserta datanya; admin, staf, institusi, dan konten (soal, tes, course, materi, audio, pengaturan) tetap.
// Default hanya MENAMPILKAN apa yang akan dihapus (dry run). Untuk benar-benar menghapus:
//   npx tsx scripts/reset-participants.ts --yes
// Wajib MONGODB_URI. Cadangkan dulu: mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)
import mongoose from "mongoose";

const YES = process.argv.includes("--yes");
// Koleksi yang berisi data per peserta dan nama field penunjuk pemiliknya.
const BY_USER = ["userId", "ownerId", "uploaderId", "participantId", "studentId"];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const host = uri.replace(/\/\/[^@]*@/, "//***@");
  console.log(`Database: ${db.databaseName} (${host})\nMode: ${YES ? "DELETE" : "dry run (add --yes to delete)"}\n`);

  const users = db.collection("users");
  const people = await users.find({ role: "participant" }).project({ _id: 1, email: 1 }).toArray();
  const ids = people.map((p) => p._id);
  const emails = people.map((p) => String(p.email).toLowerCase());
  const keep = await users.countDocuments({ role: { $ne: "participant" } });
  console.log(`Participants to delete: ${ids.length}; accounts kept (admin, staff, coach, institution admin): ${keep}\n`);
  if (!ids.length) { console.log("Nothing to do."); await mongoose.disconnect(); return; }

  const plan: { coll: string; filter: Record<string, unknown> }[] = [];
  for (const c of await db.listCollections().toArray()) {
    if (["users", "auditlogs"].includes(c.name)) continue;
    const sample = await db.collection(c.name).findOne({});
    if (!sample) continue;
    for (const f of BY_USER) if (f in sample) plan.push({ coll: c.name, filter: { [f]: { $in: ids } } });
    // Koleksi yang menunjuk peserta lewat email (OTP, undangan, antrean email).
    if (["otps", "invitations"].includes(c.name) && "email" in sample) plan.push({ coll: c.name, filter: { email: { $in: emails } } });
    if (c.name === "mailjobs") plan.push({ coll: c.name, filter: { to: { $in: emails } } });
  }
  plan.push({ coll: "users", filter: { _id: { $in: ids }, role: "participant" } });

  let total = 0;
  for (const p of plan) {
    const n = await db.collection(p.coll).countDocuments(p.filter);
    if (!n) continue;
    total += n;
    console.log(`${p.coll.padEnd(24)} ${String(n).padStart(7)}${YES ? "  deleted" : ""}`);
    if (YES) await db.collection(p.coll).deleteMany(p.filter);
  }
  if (YES) {
    // Slot coaching yang tadinya terisi peserta: kosongkan penghitung kursinya.
    const r = await db.collection("coachslots").updateMany({}, { $set: { booked: 0 } });
    console.log(`coachslots booked counter reset: ${r.modifiedCount}`);
  }
  console.log(`\n${YES ? "Deleted" : "Would delete"} ${total} documents. Audit log is kept.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
