// Migrasi sekali jalan: ganti teks data contoh berbahasa Indonesia (seed lama) ke bahasa Inggris.
// Hanya mengganti nilai yang PERSIS sama dengan teks seed lama, jadi data yang sudah diubah admin tidak tersentuh. Idempoten.
// Jalankan: npx tsx --env-file=.env.local scripts/migrate-en.ts
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { Question } from "../models/Question";
import { Test } from "../models/Test";
import { Material } from "../models/Material";
import { PRESETS } from "../lib/material-presets";
import MAP from "./migrate-en.json";

const T = MAP as Record<string, string>;
const tr = (s: unknown) => (typeof s === "string" && T[s] !== undefined ? T[s] : s);
const LISTEN = /^\[Contoh Listening (\d+)\] Dalam percakapan, apa yang akan dilakukan siswa berikutnya\?$/;

async function patch(model: mongoose.Model<any>, fields: string[], arrays: string[] = []) { // eslint-disable-line @typescript-eslint/no-explicit-any
  let n = 0;
  for (const d of await model.find().lean<Record<string, unknown>[]>()) {
    const set: Record<string, unknown> = {};
    for (const f of fields) { const v = tr(d[f]); if (v !== d[f]) set[f] = v; }
    for (const f of arrays) if (Array.isArray(d[f])) { const v = (d[f] as unknown[]).map(tr); if (JSON.stringify(v) !== JSON.stringify(d[f])) set[f] = v; }
    if (typeof d.stem === "string" && LISTEN.test(d.stem)) set.stem = d.stem.replace(LISTEN, "[Sample Listening $1] In the conversation, what will the student do next?");
    if (Object.keys(set).length) { await model.updateOne({ _id: d._id }, { $set: set }); n++; }
  }
  return n;
}

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await connectDB();
  const db = mongoose.connection.db!;
  console.log("questions:", await patch(Question, ["stem", "explanation"], ["options"]));
  console.log("tests:", await patch(Test, ["name"]));
  console.log("materials:", await patch(Material, ["title", "summary", "contentHtml"]));
  // Materi kuis HTML contoh: pakai preset bahasa Inggris bila isinya masih versi seed (belum diedit, versi 1).
  const quiz = PRESETS.find((p) => p.key === "quiz")!;
  const q = await Material.updateOne({ slug: "kuis-subject-verb", version: 1, "htmlDoc.html": /Kuis|Soal/ }, { $set: { htmlDoc: quiz.doc } });
  console.log("quiz preset:", q.modifiedCount);
  for (const [coll, fields] of [["institutions", ["name", "contactEmail"]], ["users", ["name"]], ["itpsessions", ["title", "place"]]] as const) {
    let n = 0;
    for (const d of await db.collection(coll).find().toArray()) {
      const set: Record<string, unknown> = {};
      for (const f of fields) { const v = tr(d[f]); if (v !== d[f]) set[f] = v; }
      if (Object.keys(set).length) { await db.collection(coll).updateOne({ _id: d._id }, { $set: set }); n++; }
    }
    console.log(`${coll}:`, n);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
