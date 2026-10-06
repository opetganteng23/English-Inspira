import { HttpError } from "./rbac";
import { Question } from "@/models/Question";

type Sec = { name: string; questionIds: string[] };

/** Semua soal harus ada, berstatus published, sesuai section, dan tidak dipakai dua kali dalam satu tes. */
export async function validateTestQuestions(sections: Sec[]) {
  const all = sections.flatMap((s) => s.questionIds);
  if (new Set(all).size !== all.length) throw new HttpError(400, "Ada soal yang dipakai lebih dari sekali");
  const qs = await Question.find({ _id: { $in: all } }).select("section status").lean();
  const by = new Map(qs.map((q) => [String(q._id), q]));
  for (const s of sections) {
    for (const id of s.questionIds) {
      const q = by.get(id);
      if (!q) throw new HttpError(400, "Ada soal yang tidak ditemukan");
      if (q.status !== "published") throw new HttpError(400, "Hanya soal berstatus published yang boleh masuk tes");
      if (q.section !== s.name) throw new HttpError(400, `Soal ${q.section} tidak boleh masuk section ${s.name}`);
    }
  }
}
