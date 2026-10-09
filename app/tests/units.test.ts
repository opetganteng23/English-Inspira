import { describe, it, expect } from "vitest";
import { scaleSection, estimateTotal, gradeAttempt } from "@/lib/scoring";
import { itpTotal, validSectionScore } from "@/lib/certificates";
import { PARAM_DEFAULTS } from "@/lib/config";
import { encryptField, decryptField, maskName, maskNik } from "@/lib/crypto";
import { buildSrcdoc, SANDBOX } from "@/lib/material-doc";
import { parseBridgeMessage, makeRateGate } from "@/lib/material-bridge";
import { sanitizePassage, sanitizeRich } from "@/lib/sanitize";
import { extractJson, detectDistress } from "@/lib/ai";
import { analysisResultSchema, checkResult, templateResult, numbersIn, aliasFor, inputHash, type EngineInput } from "@/lib/analysis-engine";
import { isMp3, sniffImage } from "@/lib/files";
import { scopeByInstitution, HttpError } from "@/lib/rbac";
import { Types } from "mongoose";
import { mongoSanitize } from "@/lib/mongo-sanitize";
import { parseItpScores, verifyScores, isPdf } from "@/lib/pdf-import";
import { levelUpDecision } from "@/lib/level-up";
import { overlaps, canRegister, canCancel, chargesQuota, bookableLeft, canMarkAttendance } from "@/lib/coaching-rules";
import { unitComplete, percentCorrect } from "@/lib/units";
import { nextTopicScore, topicStatus } from "@/lib/topic-stats";
import { planCandidates } from "@/lib/study-plan";
import { stuckFrom, median } from "@/lib/stuck";

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
  it("srcdoc: CSP ketat tanpa host eksternal, jembatan ber-nonce, sandbox minimal", () => {
    const d = buildSrcdoc({ html: "<b>x</b>", js: "1" }, "https://app.test", "abcdef0123456789abcdef");
    expect(d).toContain("connect-src 'none'");
    expect(d).toContain("default-src 'none'");
    expect(d).toContain("media-src https://app.test");
    expect(d).toContain("base-uri 'none'");
    expect(d).not.toMatch(/cdnjs|googleapis|gstatic/);
    expect(d).toContain('"abcdef0123456789abcdef"');
    expect(d).toContain("removeChild(s)"); // jembatan menghapus dirinya (nonce tak terbaca skrip materi)
    expect(SANDBOX).toBe("allow-scripts allow-forms");
    expect(() => buildSrcdoc({}, "https://app.test", "pendek")).toThrow();
  });
  it("jembatan: hanya pesan berversi, bernonce benar, dan bentuk valid yang diterima", () => {
    const ok = (t: string, p: unknown, n = "N0NCE0123456789a") => parseBridgeMessage({ v: 1, n, t, p }, "N0NCE0123456789a");
    expect(ok("report", { score: 80, answers: [1, 2] })).toEqual({ type: "report", score: 80, answers: [1, 2] });
    expect(ok("complete", { score: 100 })).toMatchObject({ type: "complete", score: 100 });
    expect(ok("height", { h: 300 })).toEqual({ type: "height", h: 300 });
    expect(ok("report", { score: 80 }, "salah")).toBeNull(); // nonce salah
    expect(ok("report", { score: 101 })).toBeNull();
    expect(ok("report", { score: NaN })).toBeNull();
    expect(ok("other", {})).toBeNull();
    expect(ok("report", { score: 5, answers: "x".repeat(25_000) })).toBeNull();
    expect(parseBridgeMessage({ __ei: "progress", score: 50 }, "N0NCE0123456789a")).toBeNull(); // format lama
    expect(parseBridgeMessage(null, "x")).toBeNull();
  });
  it("pembatas frekuensi jembatan", () => {
    let t = 0; const gate = makeRateGate(500, 3, () => t);
    t = 1000; expect(gate()).toBe(true);
    t = 1200; expect(gate()).toBe(false);
    t = 1600; expect(gate()).toBe(true);
    t = 2200; expect(gate()).toBe(true);
    t = 3000; expect(gate()).toBe(false); // melewati batas total
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

describe("analitik topik (MTS §13.2)", () => {
  const th = { weak: 60, priority: 40, minItems: 5 };
  it("skor akumulatif memakai alpha; topik baru memakai skor pengerjaan", () => {
    expect(nextTopicScore(null, 50, 0.3)).toBe(50);
    expect(nextTopicScore(80, 20, 0.3)).toBe(62); // 0.3×20 + 0.7×80
  });
  it("status: data kurang → insufficient; batas weak/priority/strong", () => {
    expect(topicStatus(10, 4, th)).toBe("insufficient");
    expect(topicStatus(39, 5, th)).toBe("priority");
    expect(topicStatus(40, 5, th)).toBe("weak");
    expect(topicStatus(59, 5, th)).toBe("weak");
    expect(topicStatus(60, 5, th)).toBe("ok");
    expect(topicStatus(80, 5, th)).toBe("strong");
  });
  it("median ganjil/genap/kosong", () => {
    expect([median([3, 1, 2]), median([1, 2, 3, 4]), median([])]).toEqual([2, 2.5, 0]);
  });
  it("stuck: waktu > 2× median, atau 3 salah beruntun pada topik sama", () => {
    const cfg = { medianMultiplier: 2, consecutiveWrong: 3 };
    const base = (qid: string, t: string, wrong: boolean, timeSec: number | null) => ({ qid, topics: [t], wrong, timeSec });
    expect(stuckFrom([base("a", "s|x", false, 50)], new Map([["a", 20]]), cfg)).toEqual(["s|x"]);
    expect(stuckFrom([base("a", "s|x", false, 50)], new Map(), cfg)).toEqual([]); // sampel kurang → tanpa median
    expect(stuckFrom([base("a", "s|y", true, 5), base("b", "s|y", true, 5), base("c", "s|y", true, 5)], new Map(), cfg)).toEqual(["s|y"]);
    expect(stuckFrom([base("a", "s|y", true, 5), base("b", "s|y", false, 5), base("c", "s|y", true, 5), base("d", "s|y", true, 5)], new Map(), cfg)).toEqual([]);
  });
});

describe("study plan (MTS §15)", () => {
  const t = (topic: string, score: number, status: "priority" | "weak" | "ok") => ({ skill: "structure", topic, score, status });
  it("priority lebih dulu, lalu skor terendah; mengikuti sisa slot; melewati topik yang sudah aktif", () => {
    const topics = [t("a", 55, "weak"), t("b", 30, "priority"), t("c", 20, "priority"), t("d", 75, "ok"), t("e", 58, "weak")];
    expect(planCandidates(topics, new Set(), 3).map((x) => x.topic)).toEqual(["c", "b", "a"]);
    expect(planCandidates(topics, new Set(["structure|c"]), 2).map((x) => x.topic)).toEqual(["b", "a"]);
    expect(planCandidates(topics, new Set(), 0)).toEqual([]);
  });
});

describe("unit belajar (MTS §10.1)", () => {
  it("selesai hanya bila semua materi wajib selesai dan kuis (bila ada) lulus", () => {
    expect(unitComplete(["a", "b"], new Set(["a", "b"]), false, false)).toBe(true);
    expect(unitComplete(["a", "b"], new Set(["a"]), false, false)).toBe(false);
    expect(unitComplete(["a"], new Set(["a"]), true, false)).toBe(false);
    expect(unitComplete(["a"], new Set(["a"]), true, true)).toBe(true);
    expect(unitComplete([], new Set(), true, true)).toBe(true);
  });
  it("persen benar dari skor section", () => {
    expect(percentCorrect([{ raw: 3, total: 4 }, { raw: 1, total: 4 }])).toBe(50);
    expect(percentCorrect([])).toBe(0);
  });
});

describe("aturan coaching (MTS §16)", () => {
  const rules = { presentUsed: true, absentUsed: true, excusedOnTimeUsed: false, coachCancelUsed: false };
  const at = (h: number) => new Date(Date.UTC(2026, 0, 10, 0, 0, 0) + h * 3_600_000);
  it("bentrok: hanya jika rentang waktu beririsan (menempel tidak bentrok)", () => {
    expect(overlaps(at(1), at(2), at(2), at(3))).toBe(false);
    expect(overlaps(at(1), at(3), at(2), at(4))).toBe(true);
    expect(overlaps(at(1), at(5), at(2), at(3))).toBe(true);
  });
  it("batas daftar 12 jam dan batal 24 jam (tepat di batas masih boleh)", () => {
    expect(canRegister(at(0), at(12), 12)).toBe(true);
    expect(canRegister(at(0), at(11.9), 12)).toBe(false);
    expect(canCancel(at(0), at(24), 24)).toBe(true);
    expect(canCancel(at(0), at(23), 24)).toBe(false);
  });
  it("kuota terpakai menurut quota_rules", () => {
    expect([chargesQuota("present", rules), chargesQuota("absent", rules), chargesQuota("excused", rules)]).toEqual([true, true, false]);
    expect(chargesQuota("excused", { ...rules, excusedOnTimeUsed: true })).toBe(true);
  });
  it("sisa yang bisa dipesan tidak negatif dan memperhitungkan booking mendatang", () => {
    expect(bookableLeft(8, 3, 2)).toBe(3);
    expect(bookableLeft(2, 2, 1)).toBe(0);
  });
  it("kehadiran baru bisa dicatat setelah sesi mulai", () => {
    expect(canMarkAttendance(at(1), at(2))).toBe(false);
    expect(canMarkAttendance(at(2), at(2))).toBe(true);
  });
});

describe("naik level (MTS §12)", () => {
  const rules = { requireRemedialDone: true, minSimScoreFromNextLevel: true };
  const base = { score: 500, nextMin: 460, remedialPending: 0, coachRecommends: false, rules };
  it("naik bila skor ≥ batas bawah level berikutnya dan remedial selesai", () => expect(levelUpDecision(base)).toEqual({ up: true, reasons: [] }));
  it("tertahan bila skor kurang", () => expect(levelUpDecision({ ...base, score: 459 }).up).toBe(false));
  it("tertahan bila remedial prioritas tinggi belum selesai, kecuali coach merekomendasikan", () => {
    expect(levelUpDecision({ ...base, remedialPending: 2 }).reasons[0]).toMatch(/remedial/);
    expect(levelUpDecision({ ...base, remedialPending: 2, coachRecommends: true }).up).toBe(true);
  });
  it("rekomendasi coach tidak membebaskan syarat skor", () => expect(levelUpDecision({ ...base, score: 400, coachRecommends: true }).up).toBe(false));
  it("level tertinggi tidak naik lagi; tanpa skor tertahan", () => {
    expect(levelUpDecision({ ...base, nextMin: null }).up).toBe(false);
    expect(levelUpDecision({ ...base, score: null }).up).toBe(false);
  });
  it("aturan bisa dimatikan admin", () => expect(levelUpDecision({ ...base, score: 100, remedialPending: 3, rules: { requireRemedialDone: false, minSimScoreFromNextLevel: false } }).up).toBe(true));
});

describe("mesin analisis (MTS §13.5)", () => {
  const input: EngineInput = {
    alias: "p-x", kind: "sim", level: "Intermediate", scoreEst: 505,
    sections: [{ section: "structure", raw: 20, total: 40, scaled: 50 }],
    topics: [{ topic: "subject-verb", skill: "structure", score: 35.5, items: 8, status: "priority", thisAttempt: 40 }, { topic: "inference", skill: "reading", score: 85, items: 6, status: "strong", thisAttempt: 90 }],
    gapToNextLevel: { points: 38, target: 543, nextLevel: "Advanced" },
    behaviour: { answered: 38, unanswered: 2, answerChanges: 7, avgSecPerAnswer: 31.5, stuckTopics: [] },
    thresholds: { weak: 60, priority: 40, minItems: 5 }, validTopics: ["subject-verb", "inference"],
  };
  const tpl = { summary: "Estimasi skormu {score} di level {level}.", strong: "Kuat: {strong}.", weak: "Perlu diperkuat: {weak}.", gap: "Selisih ke {next}: {gap} poin.", suggestion: "Latih {weak}." };
  const good = () => ({ summary: "Skor 505, jarak 38 poin ke Advanced.", strengths: [{ topic: "inference", evidence: "Skor 85 dari 6 butir." }], weaknesses: [{ topic: "subject-verb", severity: "priority" as const, evidence: "Skor 35.5 dari 8 butir.", likelyCause: "Konsep belum kuat." }], gapToNextLevel: { points: 38, target: 543 }, recommendations: [{ topic: "subject-verb", priority: "high" as const }], narrative: "Fokus pada subject-verb selama 2 minggu dengan 20 soal per hari.", suggestions: ["Latih 20 soal subject-verb setiap hari"] });
  it("template menghasilkan keluaran yang lolos skema dan pemeriksaan", () => {
    const t = templateResult(input, tpl);
    expect(analysisResultSchema.safeParse(t).success).toBe(true);
    expect(checkResult(t, input)).toBeNull();
    expect(t.summary).toContain("505");
    expect(t.weaknesses[0].topic).toBe("subject-verb");
  });
  it("keluaran sah diterima, termasuk angka berstatuan rencana (2 minggu, 20 soal)", () => expect(checkResult(good(), input)).toBeNull());
  it("menolak topik di luar daftar valid", () => { const r = good(); r.weaknesses[0].topic = "karangan"; expect(checkResult(r, input)).toMatch(/Topik/); });
  it("menolak angka yang tidak ada pada data", () => { const r = good(); r.summary = "Skor 520 sudah bagus."; expect(checkResult(r, input)).toMatch(/Angka 520/); });
  it("menolak jarak level yang tidak cocok dengan data", () => { const r = good(); r.gapToNextLevel = { points: 10, target: 543 }; expect(checkResult(r, input)).toMatch(/Jarak/); });
  it("angka berstatuan tidak dicek; angka telanjang dicek", () => { expect(numbersIn("20 soal selama 2 minggu, skor 505")).toEqual([505]); });
  it("alias tidak membocorkan id dan hash cache tidak bergantung alias", () => {
    expect(aliasFor("abc123")).toMatch(/^p-[0-9a-f]{10}$/);
    expect(aliasFor("abc123")).not.toContain("abc123");
    expect(inputHash(input, "v1")).toBe(inputHash({ ...input, alias: "p-lain" }, "v1"));
    expect(inputHash(input, "v1")).not.toBe(inputHash(input, "v2"));
  });
});

describe("impor PDF (MTS §14)", () => {
  const sample = ["TOEFL ITP Score Report", "Listening Comprehension 52", "Structure and Written Expression 55", "Reading Comprehension 50", "Total Score 523", "Test date 12/05/2026"].join(" | ");
  it("membaca skor per section dan total dari teks laporan", () => {
    const r = parseItpScores(sample);
    expect(r.scores).toEqual({ listening: 52, structure: 55, reading: 50, total: 523 });
    expect(r.template).toBe("itp-report");
  });
  it("PDF tanpa teks bermakna menghasilkan kosong (isi manual)", () => expect(parseItpScores("   ").scores).toEqual({}));
  it("angka di luar rentang diabaikan", () => expect(parseItpScores("Listening 99 Reading 12").scores).toEqual({}));
  it("verifikasi: total dihitung dari tiga section; rentang divalidasi", () => {
    expect(verifyScores({ listening: 50, structure: 52, reading: 51 })).toEqual({ ok: true, scores: { listening: 50, structure: 52, reading: 51, total: 510 } });
    expect(verifyScores({ structure: 55 })).toEqual({ ok: true, scores: { structure: 55 } });
    expect(verifyScores({ listening: 99 }).ok).toBe(false);
    expect(verifyScores({}).ok).toBe(false);
    expect(verifyScores({ total: 700 }).ok).toBe(false);
    expect(verifyScores({ total: 480 }).ok).toBe(true);
  });
  it("magic bytes PDF", () => { expect(isPdf(Buffer.from("%PDF-1.7 ..."))).toBe(true); expect(isPdf(Buffer.from("<html>"))).toBe(false); });
});

describe("mongo-sanitize (MTS §20)", () => {
  it("membuang kunci operator dan titik di kedalaman berapa pun", () => {
    const dirty = { a: 1, $gt: 5, "b.c": 2, n: { $where: "x", ok: [{ $ne: 1, v: 3 }] }, __proto__: { x: 1 } };
    expect(mongoSanitize(dirty)).toEqual({ a: 1, n: { ok: [{ v: 3 }] } });
  });
  it("nilai primitif dan null tidak berubah; kedalaman berlebih dipotong", () => {
    expect(mongoSanitize("x")).toBe("x"); expect(mongoSanitize(null)).toBeNull();
    let deep: unknown = 1; for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(JSON.stringify(mongoSanitize(deep))).toContain("null");
  });
});
