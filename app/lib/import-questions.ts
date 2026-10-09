import { questionSchema } from "./admin-schemas";
import { SECTIONS } from "@/models/Question";

// Impor soal dari CSV/Excel (MTS §6, Bank Soal). Bagian murni: memetakan baris tabel ke input soal yang divalidasi questionSchema.
const ALIASES: Record<string, string[]> = {
  section: ["section", "bagian", "seksi"],
  type: ["type", "tipe", "question type", "jenis"],
  stem: ["stem", "soal", "pertanyaan", "question text"],
  answer: ["answer", "jawaban", "kunci", "answer key"],
  explanation: ["explanation", "pembahasan", "penjelasan"],
  difficulty: ["difficulty", "kesulitan", "level kesulitan"],
  tags: ["tags", "tag", "topik"],
  status: ["status"],
};
const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];
const DIFF: Record<string, "easy" | "medium" | "hard"> = { easy: "easy", mudah: "easy", medium: "medium", sedang: "medium", hard: "hard", sulit: "hard" };
const SECT: Record<string, (typeof SECTIONS)[number]> = { listening: "listening", structure: "structure", "structure & written expression": "structure", "written expression": "structure", reading: "reading" };

export const QUESTION_TEMPLATE_HEADER = ["section", "type", "stem", "A", "B", "C", "D", "answer", "explanation", "difficulty", "tags", "status"];
export const QUESTION_TEMPLATE_EXAMPLE = ["structure", "subject-verb", "The results of the study ___ clear.", "is", "are", "was", "be", "B", "The plural subject 'results' takes 'are'.", "medium", "structure:subject-verb agreement", "draft"];

export type QuestionRowResult = { row: number; ok: true; data: ReturnType<typeof questionSchema.parse> } | { row: number; ok: false; error: string };

/** Format kolom tag: "skill:topic; skill:topic". Tag tanpa titik dua dianggap topik pada skill = section soal. */
export function parseTags(raw: string, section: string) {
  return raw.split(/[;|]/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const [a, ...rest] = t.split(":");
    return rest.length ? { skill: a.trim().toLowerCase(), topic: rest.join(":").trim() } : { skill: section, topic: a.trim() };
  });
}

export function mapQuestionRows(table: string[][]): QuestionRowResult[] {
  const head = new Map(table[0].map((h, i) => [h.toLowerCase().trim(), i] as const));
  const col = (k: keyof typeof ALIASES) => ALIASES[k].map((a) => head.get(a)).find((x) => x !== undefined);
  const opt = OPTION_LETTERS.map((l) => head.get(l) ?? head.get(`pilihan ${l}`) ?? head.get(`option ${l}`));
  const need = (["section", "stem", "answer"] as const).filter((k) => col(k) === undefined);
  if (need.length || opt[0] === undefined || opt[1] === undefined) return [{ row: 1, ok: false, error: `Required columns not found: ${[...need, ...(opt[0] === undefined || opt[1] === undefined ? ["A", "B"] : [])].join(", ")}` }];

  return table.slice(1).map((r, i) => {
    const row = i + 2, get = (k: keyof typeof ALIASES) => (col(k) !== undefined ? (r[col(k)!] ?? "").trim() : "");
    const section = SECT[get("section").toLowerCase()];
    if (!section) return { row, ok: false as const, error: `Unknown section "${get("section")}" (listening/structure/reading)` };
    const options = opt.map((c) => (c !== undefined ? (r[c] ?? "").trim() : "")).filter((o, idx, arr) => o && arr.slice(0, idx).every(Boolean));
    const ans = get("answer").toUpperCase();
    const answerKey = /^[A-F]$/.test(ans) ? ans.charCodeAt(0) - 65 : /^[1-6]$/.test(ans) ? Number(ans) - 1 : -1;
    if (answerKey < 0) return { row, ok: false as const, error: `Invalid answer key "${get("answer")}" (A-F)` };
    const diff = get("difficulty") ? DIFF[get("difficulty").toLowerCase()] : "medium";
    if (!diff) return { row, ok: false as const, error: `Unknown difficulty "${get("difficulty")}" (easy/medium/hard)` };
    const status = (get("status").toLowerCase() || "draft") as "draft" | "review" | "published";
    const parsed = questionSchema.safeParse({
      section, type: get("type") || "umum", stem: get("stem"), options, answerKey, explanation: get("explanation") || undefined,
      difficulty: diff, tags: parseTags(get("tags"), section), status,
    });
    return parsed.success ? { row, ok: true as const, data: parsed.data } : { row, ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid row" };
  });
}
