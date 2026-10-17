import { Types } from "mongoose";
import { connectDB } from "./db";
import { Course, CourseModule, Unit, COURSE_PARTS } from "@/models/Course";

export type CoursePart = (typeof COURSE_PARTS)[number];

/** Kerangka baku satu level: satu course per bagian TOEFL ITP, modul tetap, dan satu unit pembuka per modul. Isi materi dan soal diisi tim konten. */
export const PART_TEMPLATES: { part: CoursePart; title: string; description: string; modules: string[] }[] = [
  { part: "listening_a", title: "Listening Part A: Short Conversations", description: "Percakapan pendek dengan satu pertanyaan.", modules: ["Pengantar dan strategi", "Detail dan Main idea", "Inference dan Implication", "Idiom, Agreement, dan Suggestion"] },
  { part: "listening_b", title: "Listening Part B: Long Conversations", description: "Percakapan panjang dengan beberapa pertanyaan.", modules: ["Pengantar dan strategi", "Main idea dan Purpose", "Detail dan Inference"] },
  { part: "listening_c", title: "Listening Part C: Talks and Lectures", description: "Monolog dan kuliah dengan beberapa pertanyaan.", modules: ["Pengantar dan strategi", "Main idea dan Purpose", "Detail dan Inference"] },
  { part: "structure", title: "Structure", description: "Melengkapi kalimat dengan bentuk yang tepat.", modules: ["Pengantar dan strategi", "Verb form dan Tenses", "Subject-verb agreement", "Clause, Conjunction, dan Parallelism", "Word form dan Article"] },
  { part: "written_expression", title: "Written Expression", description: "Mengidentifikasi bagian kalimat yang salah.", modules: ["Pengantar dan strategi", "Kesalahan verb dan agreement", "Word form, Article, dan Plural", "Parallelism dan Redundancy"] },
  { part: "reading", title: "Reading", description: "Bacaan akademik dengan pertanyaan pemahaman.", modules: ["Pengantar dan strategi", "Detail dan Vocabulary in context", "Inference dan Main idea", "Reference, Purpose, dan Negative fact"] },
];

/**
 * Membuat kerangka baku untuk satu level. Aman dijalankan ulang: bagian yang sudah punya course di level itu dilewati.
 * Course baru berstatus Preview only (tidak terlihat peserta) sampai admin merilisnya.
 */
export async function scaffoldLevel(levelId: string) {
  await connectDB();
  const lid = new Types.ObjectId(levelId);
  const existing = new Set((await Course.find({ levelId: lid, part: { $in: [...COURSE_PARTS] } }).select("part").lean()).map((c) => String(c.part)));
  let created = 0, skipped = 0, modules = 0, units = 0;
  for (const [i, t] of PART_TEMPLATES.entries()) {
    if (existing.has(t.part)) { skipped++; continue; }
    const c = await Course.create({ levelId: lid, title: t.title, description: t.description, order: i, part: t.part, active: true, previewMode: true });
    created++;
    for (const [k, name] of t.modules.entries()) {
      const m = await CourseModule.create({ courseId: c._id, title: name, order: k, active: true });
      await Unit.create({ courseId: c._id, moduleId: m._id, title: name, order: k, active: true });
      modules++; units++;
    }
  }
  return { created, skipped, modules, units };
}
