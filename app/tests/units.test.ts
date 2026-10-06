import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { scaleSection, estimateTotal, gradeAttempt } from "@/lib/scoring";
import { itpTotal, validSectionScore } from "@/lib/certificates";
import { voucherDiscount, voucherProblem } from "@/lib/pricing";
import { verifySignature, mapStatus } from "@/lib/midtrans";
import { encryptField, decryptField, maskName, maskNik } from "@/lib/crypto";
import { buildSrcdoc } from "@/lib/material-doc";
import { sanitizePassage, sanitizeRich } from "@/lib/sanitize";
import { extractJson, ruleBasedAnalysis, detectDistress, analysisSchema } from "@/lib/ai";
import { isMp3, sniffImage } from "@/lib/files";
import { scopeByInstitution, HttpError } from "@/lib/rbac";
import { Types } from "mongoose";

describe("skor", () => {
  it("konversi linear berada di 31–68 dan monoton", () => {
    expect(scaleSection("structure", 0, 40)).toBe(31);
    expect(scaleSection("structure", 40, 40)).toBe(68);
    expect(scaleSection("structure", 20, 40)).toBeGreaterThan(scaleSection("structure", 10, 40));
  });
  it("section kosong tidak membagi nol", () => expect(scaleSection("reading", 0, 0)).toBe(31));
  it("total = rata-rata x10 dan dibatasi 310–677", () => {
    expect(estimateTotal([{ section: "listening", raw: 0, total: 1, scaled: 31 }, { section: "structure", raw: 0, total: 1, scaled: 31 }, { section: "reading", raw: 0, total: 1, scaled: 31 }])).toBe(310);
    expect(itpTotal(50, 52, 51)).toBe(510);
    expect(itpTotal(68, 68, 68)).toBe(677);
    expect(itpTotal(31, 31, 31)).toBe(310);
  });
  it("menilai jawaban: benar, salah, kosong", () => {
    const r = gradeAttempt([{ name: "structure", questionIds: ["a", "b", "c"] }], new Map([["a", 1], ["b", 2], ["c", 0]]), new Map<string, number | undefined>([["a", 1], ["b", 0]]));
    expect(r.scoreRaw).toBe(1);
    expect(r.sectionScores[0]).toMatchObject({ raw: 1, total: 3 });
  });
  it("validasi skor section resmi", () => {
    expect([30, 31, 68, 69, 50.5, NaN, "50"].map(validSectionScore)).toEqual([false, true, true, false, false, false, false]);
  });
});

describe("harga & voucher", () => {
  it("persen dan nominal dihitung, tidak melebihi dasar", () => {
    expect(voucherDiscount({ type: "percent", value: 10 }, 650000)).toBe(65000);
    expect(voucherDiscount({ type: "fixed", value: 900000 }, 650000)).toBe(650000);
    expect(voucherDiscount({ type: "percent", value: 150 }, 1000)).toBe(1000);
    expect(voucherDiscount({ type: "fixed", value: 5 }, 0)).toBe(0);
  });
  it("menolak voucher nonaktif, kedaluwarsa, atau habis kuota", () => {
    expect(voucherProblem(null)).toBeTruthy();
    expect(voucherProblem({ active: false, maxUse: 0, used: 0 })).toBeTruthy();
    expect(voucherProblem({ active: true, maxUse: 0, used: 0, validUntil: new Date(Date.now() - 1000) })).toBeTruthy();
    expect(voucherProblem({ active: true, maxUse: 2, used: 2 })).toBeTruthy();
    expect(voucherProblem({ active: true, maxUse: 0, used: 99 })).toBeNull();
  });
});

describe("webhook Midtrans", () => {
  const key = "SB-Mid-server-test";
  const n = { order_id: "EPTA-1", status_code: "200", gross_amount: "585000.00" };
  const sig = createHash("sha512").update(n.order_id + n.status_code + n.gross_amount + key).digest("hex");
  it("menerima signature benar dan menolak yang salah/kosong", () => {
    expect(verifySignature({ ...n, signature_key: sig }, key)).toBe(true);
    expect(verifySignature({ ...n, signature_key: sig.replace(/.$/, "0") }, key)).toBe(false);
    expect(verifySignature({ ...n, gross_amount: "1.00", signature_key: sig }, key)).toBe(false);
    expect(verifySignature({ ...n }, key)).toBe(false);
    expect(verifySignature({ ...n, signature_key: sig }, "")).toBe(false);
  });
  it("memetakan status transaksi", () => {
    expect(mapStatus({ transaction_status: "settlement" })).toBe("paid");
    expect(mapStatus({ transaction_status: "capture", fraud_status: "accept" })).toBe("paid");
    expect(mapStatus({ transaction_status: "capture", fraud_status: "challenge" })).toBe("pending");
    expect(mapStatus({ transaction_status: "expire" })).toBe("failed");
    expect(mapStatus({ transaction_status: "refund" })).toBe("refunded");
    expect(mapStatus({ transaction_status: "pending" })).toBe("pending");
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

describe("isolasi institusi (C10, level query)", () => {
  const inst = new Types.ObjectId();
  it("inst_admin selalu dipaksa filter institusinya; filter pemanggil tidak bisa menimpanya", () => {
    const f = scopeByInstitution({ role: "inst_admin", institutionId: inst }, { institutionId: new Types.ObjectId(), role: "participant" } as never) as { institutionId: Types.ObjectId };
    expect(String(f.institutionId)).toBe(String(inst));
  });
  it("inst_admin tanpa institusi ditolak", () => {
    expect(() => scopeByInstitution({ role: "inst_admin", institutionId: undefined } as never)).toThrow(HttpError);
  });
  it("admin tidak dibatasi", () => expect(scopeByInstitution({ role: "admin" } as never, { a: 1 } as never)).toEqual({ a: 1 }));
});
