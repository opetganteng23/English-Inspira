import { connectDB } from "./db";
import { Question, QuestionType, type Section } from "@/models/Question";

const CI = { locale: "en", strength: 2 } as const;

/** Jenis soal bawaan format TOEFL ITP. Dipakai hanya saat daftar jenis masih kosong. */
const DEFAULTS: Record<Section, [string, string][]> = {
  listening: [
    ["Short conversations (Part A)", "Two-speaker exchanges with one question each."],
    ["Longer conversations (Part B)", "Extended conversations with several questions."],
    ["Talks (Part C)", "Mini-lectures and announcements."],
  ],
  structure: [
    ["Sentence completion", "Choose the word or phrase that completes the sentence."],
    ["Error identification", "Find the underlined part that must be corrected (Written Expression)."],
  ],
  reading: [
    ["Main idea", "What the passage is mostly about."],
    ["Detail", "Stated facts in the passage."],
    ["Inference", "What can be concluded but is not stated."],
    ["Vocabulary in context", "Meaning of a word as used in the passage."],
    ["Reference", "What a pronoun or phrase refers to."],
  ],
};

/** Daftarkan jenis bila belum ada (tanpa membedakan huruf besar/kecil). Dipanggil saat soal dibuat, diubah, atau diimpor. */
export async function registerQuestionType(section: Section, name: string) {
  const n = name.trim();
  if (!n) return;
  await QuestionType.updateOne({ section, name: n }, { $setOnInsert: { section, name: n, order: 999 } }, { upsert: true, collation: CI }).catch(() => {});
}

/** Pastikan daftar jenis ada: isi bawaan bila kosong, dan daftarkan jenis yang sudah dipakai soal lama agar tidak ada yang yatim. */
export async function ensureQuestionTypes() {
  await connectDB();
  if ((await QuestionType.estimatedDocumentCount()) === 0) {
    let order = 0;
    for (const [section, list] of Object.entries(DEFAULTS) as [Section, [string, string][]][]) {
      for (const [name, description] of list) {
        await QuestionType.updateOne({ section, name }, { $setOnInsert: { section, name, description, order: order++ } }, { upsert: true, collation: CI }).catch(() => {});
      }
    }
  }
  const used = await Question.aggregate<{ _id: { section: Section; type: string } }>([{ $group: { _id: { section: "$section", type: "$type" } } }]);
  for (const u of used) if (u._id.type) await registerQuestionType(u._id.section, u._id.type);
}
