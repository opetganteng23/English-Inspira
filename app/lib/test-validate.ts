import { HttpError } from "./rbac";
import { Question } from "@/models/Question";

type Sec = { name: string; questionIds: string[] };

/** Semua soal harus ada, berstatus published, sesuai section, dan tidak dipakai dua kali dalam satu tes. */
export async function validateTestQuestions(sections: Sec[]) {
  const all = sections.flatMap((s) => s.questionIds);
  if (new Set(all).size !== all.length) throw new HttpError(400, "A question is used more than once");
  const qs = await Question.find({ _id: { $in: all } }).select("section status").lean();
  const by = new Map(qs.map((q) => [String(q._id), q]));
  for (const s of sections) {
    for (const id of s.questionIds) {
      const q = by.get(id);
      if (!q) throw new HttpError(400, "Some questions were not found");
      if (q.status !== "published") throw new HttpError(400, "Only published questions can be added to a test");
      if (q.section !== s.name) throw new HttpError(400, `A ${q.section} question cannot be added to the ${s.name} section`);
    }
  }
}
