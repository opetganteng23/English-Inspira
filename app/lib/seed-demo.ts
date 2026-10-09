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
    { $setOnInsert: { name: "Sample University", code: "DEMO2026", seats: 120, batch: "Batch 2026", contactEmail: "coordinator@example.ac.id", contractStart: new Date(), contractEnd: new Date(Date.now() + 365 * 86_400_000), status: "active" } },
    { upsert: true }
  );
  // Akun contoh diundang (email undangan dicetak ke konsol di dev). Masuk dengan OTP ke email ini.
  const inst = await Institution.findOne({ code: "DEMO2026" });
  const demo: { email: string; name: string; role: "coach" | "inst_admin" | "participant" }[] = [
    { email: "coach@demo.local", name: "Demo Coach", role: "coach" },
    { email: "instadmin@demo.local", name: "Demo Institution Admin", role: "inst_admin" },
    { email: "peserta1@demo.local", name: "Participant One", role: "participant" },
    { email: "peserta2@demo.local", name: "Participant Two", role: "participant" },
    { email: "peserta3@demo.local", name: "Participant Three", role: "participant" },
  ];
  for (const d of demo) if (inst && !(await User.exists({ email: d.email }))) await createMember(inst._id, d);

  const now = Date.now();
  const day = 86_400_000;
  for (const [i, s] of [{ title: "TOEFL ITP Saturday (sample)", days: 35, quota: 30 }, { title: "TOEFL ITP next Saturday (sample)", days: 63, quota: 40 }].entries()) {
    if (!(await ItpSession.exists({ title: s.title }))) await ItpSession.create({ title: s.title, date: new Date(now + s.days * day), place: i === 0 ? "Language Lab, Building A (sample)" : "Main Hall (sample)", quota: s.quota, status: "open" });
  }

  const rich = sanitizeRich(`<h2>Subject-Verb Agreement</h2><p>The verb must <b>agree</b> with the subject, not with the word next to it.</p><ul><li>The <u>results</u> of the study <b>are</b> clear.</li><li>Each of the students <b>has</b> a book.</li></ul><blockquote>Tip: cross out the "of …" phrase, then find the main subject.</blockquote>`);
  if (!(await Material.exists({ slug: "subject-verb-agreement" })))
    await Material.create({ title: "Subject-Verb Agreement", slug: "subject-verb-agreement", summary: "Basic rules and common traps in Structure.", kind: "rich", contentHtml: rich, tags: ["structure", "grammar"], access: "free", status: "published", version: 1, publishedAt: new Date() });
  const quiz = PRESETS.find((p) => p.key === "quiz")!;
  if (!(await Material.exists({ slug: "kuis-subject-verb" })))
    await Material.create({ title: "Subject-Verb Quiz", slug: "kuis-subject-verb", summary: "An interactive 3-question exercise with a score.", kind: "html", htmlDoc: quiz.doc, tags: ["structure", "practice"], access: "paid", status: "published", version: 1, publishedAt: new Date() });

  return { institution: "DEMO2026", sessions: await ItpSession.countDocuments(), materials: await Material.countDocuments() };
}
