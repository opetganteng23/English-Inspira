import { describe, it, expect } from "vitest";
import { normalizeGenerated, generateInput, stemKey } from "@/lib/ai-questions";

const input = generateInput.parse({ section: "structure", type: "Grammar", skill: "structure", topic: "tenses", difficulty: "easy", count: 3 });
const good = { stem: "She ___ to school every day.", options: ["A. go", "goes", "going", "gone"], answerKey: 1, explanation: "Third person singular." };

describe("normalizeGenerated", () => {
  it("menerima soal valid dan membuang label huruf di pilihan", () => {
    const r = normalizeGenerated({ questions: [good] }, input, new Set());
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].options[0]).toBe("go");
    expect(r.dropped).toBe(0);
  });
  it("membuang soal tidak valid: kunci di luar pilihan, pilihan kembar, stem kosong", () => {
    const r = normalizeGenerated({ questions: [{ ...good, options: ["a", "a", "b", "c"] }, { ...good, stem: "   " }, good] }, input, new Set());
    expect(r.drafts).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });
  it("menandai duplikat terhadap bank soal dan antarhasil", () => {
    const r = normalizeGenerated({ questions: [good, good] }, input, new Set([stemKey(good.stem)]));
    expect(r.drafts.map((d) => d.duplicate)).toEqual([true, true]);
  });
  it("keluaran model yang rusak menghasilkan daftar kosong", () => expect(normalizeGenerated({ foo: 1 }, input, new Set()).drafts).toEqual([]));
  it("hanya Structure yang didukung dan jumlah dibatasi 10", () => {
    expect(generateInput.safeParse({ section: "listening", type: "x", skill: "a", topic: "b" }).success).toBe(false);
    expect(generateInput.safeParse({ section: "structure", type: "x", skill: "a", topic: "b", count: 11 }).success).toBe(false);
  });
});
