import { describe, it, expect } from "vitest";
import { scaleSection, estimateTotal, gradeAttempt } from "@/lib/scoring";
import { itpTotal, validSectionScore } from "@/lib/certificates";
import { PARAM_DEFAULTS } from "@/lib/config";
import { encryptField, decryptField, maskName, maskNik } from "@/lib/crypto";
import { buildSrcdoc } from "@/lib/material-doc";
import { sanitizePassage, sanitizeRich } from "@/lib/sanitize";
import { extractJson, ruleBasedAnalysis, detectDistress, analysisSchema } from "@/lib/ai";
import { isMp3, sniffImage } from "@/lib/files";
import { scopeByInstitution, HttpError } from "@/lib/rbac";
import { Types } from "mongoose";

const conv = PARAM_DEFAULTS.score_conversion;

describe("skor", () => {
  it("konversi linear berada di 31–68 dan monoton", () => {
    expect(scaleSection(conv, "structure", 0, 40)).toBe(31);
    expect(scaleSection(conv, "structure", 40, 40)).toBe(68);
    expect(scaleSection(conv, "structure", 20, 40)).toBeGreaterThan(scaleSection(conv, "structure", 10, 40));
  });
  it("mode tabel memakai tabel resmi, dan jatuh ke linear bila raw tidak ada", () => {
    const t = { ...conv, mode: "table" as const, tables: { ...conv.tables, structure: { "20": 55 } } };
    expect(scaleSection(t, "structure", 20, 40)).toBe(55);
    expect(scaleSection(t, "structure", 40, 40)).toBe(68);
  });
  it("section kosong tidak membagi nol", () => expect(scaleSection(conv, "reading", 0, 0)).toBe(31));
  it("total = rata-rata x10 dan dibatasi 310–677", () => {
    expect(estimateTotal([{ section: "listening", raw: 0, total: 1, scaled: 31 }, { section: "structure", raw: 0, total: 1, scaled: 31 }, { section: "reading", raw: 0, total: 1, scaled: 31 }])).toBe(310);
    expect(itpTotal(50, 52, 51)).toBe(510);
    expect(itpTotal(68, 68, 68)).toBe(677);
    expect(itpTotal(31, 31, 31)).toBe(310);
  });
  it("menilai jawaban: benar, salah, kosong", () => {
    const r = gradeAttempt(conv, [{ name: "structure", questionIds: ["a", "b", "c"] }], new Map([["a", 1], ["b", 2], ["c", 0]]), new Map<string, number | undefined>([["a", 1], ["b", 0]]));
    expect(r.scoreRaw).toBe(1);
    expect(r.sectionScores[0]).toMatchObject({ raw: 1, total: 3 });
  });
  it("validasi skor section resmi", () => {
    expect([30, 31, 68, 69, 50.5, NaN, "50"].map(validSectionScore)).toEqual([false, true, true, false, false, false, false]);
  });
});

describe("enkripsi & penyamaran", () => {
  it("AES-GCM bolak-balik, acak per enkripsi, dan menolak data dirusak", () => {
    const a = encryptField("3201010101010001"), b = encryptField("3201010101010001");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("3201010101010001");
    const parts = a.split(":"); const buf = Buffer.from(parts[3], "base64"); buf[0] ^= 1; parts[3] = buf.toString("base64");
    expect(() => decryptField(parts.join(":"))).toThrow(); // GCM mendeteksi data dirusak
  });
  it("menyamarkan NIK dan nama", () => {
    expect(maskNik("3201010101010001")).toBe("••••••••••••0001");
    expect(maskName("Budi Santoso")).not.toContain("udi");
    expect(maskName("Budi Santoso").startsWith("B")).toBe(true);
  });
});

describe("keamanan materi", () => {
  it("srcdoc: CSP memblokir koneksi/anak dokumen dan jembatan progres ada", () => {
    const d = buildSrcdoc({ html: "<b>x</b>", js: "1" }, "https://app.test");
    expect(d).toContain("connect-src 'none'");
    expect(d).toContain("default-src 'none'");
    expect(d).toContain("media-src https://app.test");
    expect(d).toContain("window.EI=");
  });
  it("sanitizePassage membuang script, handler, dan gambar luar", () => {
    const o = sanitizePassage('<p onclick="x()">a</p><script>1</script><img src="http://evil/x.png"><img src="/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa">');
    expect(o).not.toMatch(/onclick|script|evil/);
    expect(o).toContain("/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa");
  });
  it("sanitizeRich: tautan javascript:, iframe asing, dan audio tanpa id dibuang", () => {
    const o = sanitizeRich('<a href="javascript:alert(1)">x</a><iframe src="https://evil.com/"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe><audio src="x.mp3"></audio><audio data-audio-id="aaaaaaaaaaaaaaaaaaaaaaaa"></audio>');
    expect(o).not.toMatch(/javascript:|evil\.com|x\.mp3/);
    expect(o).toContain("youtube.com/embed/abc");
    expect(o).toContain('data-audio-id="aaaaaaaaaaaaaaaaaaaaaaaa"');
  });
});

describe("berkas", () => {
  it("mengenali MP3 hanya dari isi, bukan ekstensi", () => {
    expect(isMp3(Buffer.from("ID3\x04\x00\x00", "latin1"))).toBe(true);
    expect(isMp3(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe(true);
    expect(isMp3(Buffer.from("hello world, bukan mp3"))).toBe(false);
  });
  it("mengenali gambar valid dan menolak SVG/teks", () => {
    expect(sniffImage(Buffer.from("89504e470d0a1a0a0000000d", "hex"))).toBe("image/png");
    expect(sniffImage(Buffer.from("ffd8ffe000104a464946", "hex").subarray(0, 12).length < 12 ? Buffer.concat([Buffer.from("ffd8ffe000104a464946", "hex"), Buffer.alloc(4)]) : Buffer.alloc(12))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
});

describe("AI (mode dasar & parser)", () => {
  it("mengambil JSON dari teks berpagar kode", () => expect(extractJson('Berikut:\n```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  it("analisis berbasis aturan lolos skema dan menyebut selisih target", () => {
    const a = ruleBasedAnalysis({ testName: "T", kind: "sim", targetScore: 550, scoreEst: 500, sections: [{ section: "reading", raw: 10, total: 30, scaled: 45, avgSecPerQuestion: 90, unanswered: 2 }, { section: "structure", raw: 20, total: 30, scaled: 55, avgSecPerQuestion: 30, unanswered: 0 }], weakTypes: [{ section: "structure", type: "subject-verb", wrong: 4, total: 6 }] });
    expect(analysisSchema.safeParse(a).success).toBe(true);
    expect(a.gapToTarget.gap).toBe(50);
    expect(a.summary).toContain("50 poin");
  });
  it("mendeteksi tanda stres berat", () => {
    expect(detectDistress("saya ingin bunuh diri")).toBe(true);
    expect(detectDistress("bagaimana cara naik skor reading?")).toBe(false);
  });
});

describe("isolasi institusi (level query)", () => {
  const inst = new Types.ObjectId();
  it("inst_admin selalu dipaksa filter institusinya; filter pemanggil tidak bisa menimpanya", () => {
    const f = scopeByInstitution({ role: "inst_admin", institutionId: inst }, { institutionId: new Types.ObjectId(), role: "participant" } as never) as { institutionId: Types.ObjectId };
    expect(String(f.institutionId)).toBe(String(inst));
  });
  it("coach juga dipaksa ke institusinya", () => {
    const f = scopeByInstitution({ role: "coach", institutionId: inst } as never, { role: "participant" } as never) as { institutionId: Types.ObjectId };
    expect(String(f.institutionId)).toBe(String(inst));
  });
  it("inst_admin tanpa institusi ditolak", () => {
    expect(() => scopeByInstitution({ role: "inst_admin", institutionId: undefined } as never)).toThrow(HttpError);
  });
  it("admin tidak dibatasi", () => expect(scopeByInstitution({ role: "admin" } as never, { a: 1 } as never)).toEqual({ a: 1 }));
});
