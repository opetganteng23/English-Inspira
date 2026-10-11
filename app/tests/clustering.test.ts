import { describe, it, expect } from "vitest";
import { normName, nameSimilarity, matchPerson, findNameInText } from "@/lib/name-match";
import { cefrForItp, toItp, fromItp, equivalents, equivalenceSchema, EQUIVALENCE_DEFAULT, type Equivalence } from "@/lib/score-equivalence";
import { pickClass } from "@/lib/class-pick";

describe("pencocokan nama", () => {
  it("normalisasi membuang aksen, tanda baca, dan gelar", () => expect(normName("Dr. Siti  Nurhaliza, S.Pd")).toBe("siti nurhaliza"));
  it("sama persis 1, urutan kata beda 0.95, salah ketik kecil tinggi, nama lain rendah", () => {
    expect(nameSimilarity("Budi Santoso", "budi santoso")).toBe(1);
    expect(nameSimilarity("Santoso Budi", "Budi Santoso")).toBe(0.95);
    expect(nameSimilarity("Budi Santosa", "Budi Santoso")).toBeGreaterThan(0.8);
    expect(nameSimilarity("Andi Wijaya", "Budi Santoso")).toBeLessThan(0.5);
  });
  const people = [{ id: "1", name: "Budi Santoso", email: "budi@x.id" }, { id: "2", name: "Budi Hartono" }, { id: "3", name: "Siti Aminah" }];
  it("email sama persis selalu menang", () => expect(matchPerson("Siapa Saja", "BUDI@x.id", people)[0]).toMatchObject({ id: "1", confidence: 1 }));
  it("kandidat diurutkan dari yang paling mirip", () => expect(matchPerson("Budi Santosa", undefined, people)[0].id).toBe("1"));
  it("nama di dalam isi PDF ditemukan", () => expect(findNameInText("CERTIFICATE\nThis is to certify that SITI AMINAH has completed", people)?.id).toBe("3"));
});

describe("padanan skor", () => {
  it("ITP ke CEFR memakai batas ETS", () => {
    expect([336, 337, 459, 460, 542, 543, 626, 627].map(cefrForItp)).toEqual(["A1", "A2", "A2", "B1", "B1", "B2", "B2", "C1"]);
  });
  it("skala sama dengan ITP: skor tidak berubah", () => expect(toItp(505, "oce", EQUIVALENCE_DEFAULT)).toBe(505));
  const custom: Equivalence = { ...EQUIVALENCE_DEFAULT, oce: { name: "OCE", sameAsItp: false, min: 0, max: 100, anchors: { A2: 20, B1: 40, B2: 60, C1: 80 } } };
  it("skala 0-100: batas CEFR dipetakan tepat dan di antaranya linear", () => {
    expect(toItp(40, "oce", custom)).toBe(460);
    expect(toItp(60, "oce", custom)).toBe(543);
    expect(toItp(50, "oce", custom)).toBe(Math.round((460 + 543) / 2));
    expect(toItp(0, "oce", custom)).toBe(310);
    expect(toItp(100, "oce", custom)).toBe(677);
  });
  it("konversi bolak-balik konsisten", () => expect(fromItp(toItp(70, "oce", custom), "oce", custom)).toBe(70));
  it("equivalents memuat ITP, CEFR, OCE, PURE", () => {
    const e = equivalents(543, custom);
    expect(e).toMatchObject({ itp: 543, cefr: "B2", oce: { score: 60, estimated: true }, pure: { score: 543, estimated: false } });
  });
  it("validasi: batas harus naik dan di dalam rentang", () => {
    expect(equivalenceSchema.safeParse(custom).success).toBe(true);
    expect(equivalenceSchema.safeParse({ ...custom, oce: { ...custom.oce, anchors: { A2: 20, B1: 50, B2: 40, C1: 80 } } }).success).toBe(false);
  });
});

describe("pilih kelas", () => {
  const cls = (id: string, capacity: number, count: number) => ({ id, capacity, count });
  it("kelas penuh tidak dipilih; tanpa kursi menghasilkan null", () => {
    expect(pickClass([cls("a", 2, 2)], () => 0)).toBeNull();
    expect(pickClass([cls("a", 2, 2), cls("b", 2, 1)], () => 0)).toBe("b");
  });
  it("kelas yang paling longgar diutamakan, seri diacak", () => {
    expect(pickClass([cls("a", 10, 5), cls("b", 10, 2), cls("c", 10, 7)], () => 0.99)).toBe("b");
    expect(pickClass([cls("a", 10, 3), cls("b", 10, 3)], () => 0)).toBe("a");
    expect(pickClass([cls("a", 10, 3), cls("b", 10, 3)], () => 0.99)).toBe("b");
  });
  it("keterisian dibandingkan relatif terhadap kapasitas", () => expect(pickClass([cls("a", 10, 5), cls("b", 30, 10)], () => 0)).toBe("b"));
});
