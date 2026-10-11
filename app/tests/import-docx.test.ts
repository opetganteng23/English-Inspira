import { describe, it, expect } from "vitest";
import { docxTextToTable } from "@/lib/import-docx";
import { mapQuestionRows } from "@/lib/import-questions";

const doc = `Section: structure
Type: subject-verb
Difficulty: hard
Tags: structure:subject-verb agreement
Status: draft

1. The results of the study ___
clear to everyone.
A. is
B. are
C. was
D. be
Answer: B
Explanation: Plural subject
takes are.

2) She ___ to school.
(A) go
(B) goes
Answer: b

Type: tenses
3. They ___ yesterday.
A. left
B. leave
Answer: A
`;

describe("docxTextToTable", () => {
  const t = docxTextToTable(doc);
  it("menghasilkan satu baris per soal dengan header templat", () => {
    expect(t[0].slice(0, 3)).toEqual(["section", "type", "stem"]);
    expect(t).toHaveLength(4);
  });
  it("baris lanjutan menyambung stem dan pembahasan", () => {
    expect(t[1][2]).toBe("The results of the study ___ clear to everyone.");
    expect(t[1][8]).toBe("Plural subject takes are.");
  });
  it("pengaturan berlaku untuk soal di bawahnya dan dapat diganti", () => {
    expect(t[1][1]).toBe("subject-verb");
    expect(t[3][1]).toBe("tenses");
    expect(t[2][9]).toBe("hard");
  });
  it("hasilnya lolos validasi impor soal yang sama dengan CSV", () => {
    const r = mapQuestionRows(t);
    expect(r.every((x) => x.ok)).toBe(true);
    const ok = r.filter((x): x is Extract<typeof x, { ok: true }> => x.ok);
    expect(ok[0].data.answerKey).toBe(1);
    expect(ok[1].data.options).toEqual(["go", "goes"]);
    expect(ok[1].data.answerKey).toBe(1);
  });
  it("teks tanpa soal bernomor menghasilkan tabel kosong", () => expect(docxTextToTable("Hello world")).toHaveLength(1));
});
