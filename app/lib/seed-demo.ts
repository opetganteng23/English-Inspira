import { connectDB } from "./db";
import { Institution } from "@/models/Institution";
import { createMember } from "./participants";
import { User } from "@/models/User";
import { ItpSession } from "@/models/Itp";
import { Material } from "@/models/Material";
import { PRESETS } from "./material-presets";
import { sanitizeRich } from "./sanitize";

/** Data contoh untuk pengembangan/demo. Idempoten. JANGAN dijalankan di produksi tanpa sadar. */
export async function seedDemo() {
  await connectDB();

  await Institution.updateOne(
    { code: "DEMO2026" },
    { $setOnInsert: { name: "Universitas Contoh", code: "DEMO2026", seats: 120, batch: "Batch 2026", contactEmail: "koordinator@contoh.ac.id", contractStart: new Date(), contractEnd: new Date(Date.now() + 365 * 86_400_000), status: "active" } },
    { upsert: true }
  );
  // Akun contoh diundang (email undangan dicetak ke konsol di dev). Masuk dengan OTP ke email ini.
  const inst = await Institution.findOne({ code: "DEMO2026" });
  const demo: { email: string; name: string; role: "coach" | "inst_admin" | "participant" }[] = [
    { email: "coach@demo.local", name: "Coach Demo", role: "coach" },
    { email: "instadmin@demo.local", name: "Admin Institusi Demo", role: "inst_admin" },
    { email: "peserta1@demo.local", name: "Peserta Satu", role: "participant" },
    { email: "peserta2@demo.local", name: "Peserta Dua", role: "participant" },
    { email: "peserta3@demo.local", name: "Peserta Tiga", role: "participant" },
  ];
  for (const d of demo) if (inst && !(await User.exists({ email: d.email }))) await createMember(inst._id, d);

  const now = Date.now();
  const day = 86_400_000;
  for (const [i, s] of [{ title: "TOEFL ITP Sabtu (contoh)", days: 35, quota: 30 }, { title: "TOEFL ITP Sabtu berikutnya (contoh)", days: 63, quota: 40 }].entries()) {
    if (!(await ItpSession.exists({ title: s.title }))) await ItpSession.create({ title: s.title, date: new Date(now + s.days * day), place: i === 0 ? "Lab Bahasa, Gedung A (contoh)" : "Aula Utama (contoh)", quota: s.quota, status: "open" });
  }

  const rich = sanitizeRich(`<h2>Subject–Verb Agreement</h2><p>Kata kerja harus <b>sesuai</b> dengan subjek, bukan dengan kata di dekatnya.</p><ul><li>The <u>results</u> of the study <b>are</b> clear.</li><li>Each of the students <b>has</b> a book.</li></ul><blockquote>Tips: coret frasa "of …" lalu cari subjek utamanya.</blockquote>`);
  if (!(await Material.exists({ slug: "subject-verb-agreement" })))
    await Material.create({ title: "Subject–Verb Agreement", slug: "subject-verb-agreement", summary: "Aturan dasar dan jebakan umum di Structure.", kind: "rich", contentHtml: rich, tags: ["structure", "grammar"], access: "free", status: "published", version: 1, publishedAt: new Date() });
  const quiz = PRESETS.find((p) => p.key === "quiz")!;
  if (!(await Material.exists({ slug: "kuis-subject-verb" })))
    await Material.create({ title: "Kuis Subject–Verb", slug: "kuis-subject-verb", summary: "Latihan interaktif 3 soal dengan skor.", kind: "html", htmlDoc: quiz.doc, tags: ["structure", "latihan"], access: "paid", status: "published", version: 1, publishedAt: new Date() });

  return { institution: "DEMO2026", sessions: await ItpSession.countDocuments(), materials: await Material.countDocuments() };
}
