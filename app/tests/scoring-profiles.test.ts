import { describe, it, expect } from "vitest";
import { validateTables, previewScore, toConversion } from "@/lib/scoring-profiles";

const tbl = (rows: [number, number][]) => Object.fromEntries(rows.map(([r, s]) => [String(r), s]));
const full = { listening: tbl([[0, 31], [1, 31], [2, 32], [3, 33]]), structure: tbl([[0, 31], [1, 33]]), reading: tbl([[0, 31], [1, 32], [2, 34]]) };

describe("validateTables", () => {
  it("mode linear tidak memerlukan tabel", () => expect(validateTables("linear", 31, 68, { listening: {}, structure: {}, reading: {} }).errors).toEqual([]));
  it("tabel lengkap tanpa lubang lolos", () => expect(validateTables("table", 31, 68, full)).toEqual({ errors: [], warnings: [] }));
  it("tabel kosong ditolak per section", () => {
    const r = validateTables("table", 31, 68, { listening: {}, structure: full.structure, reading: full.reading });
    expect(r.errors.join(" ")).toMatch(/listening: the table is empty/);
  });
  it("nilai menurun saat raw naik ditolak", () => {
    const r = validateTables("table", 31, 68, { ...full, structure: tbl([[0, 31], [1, 40], [2, 35]]) });
    expect(r.errors.join(" ")).toMatch(/drops from raw 1 to 2/);
  });
  it("nilai di luar rentang skala ditolak", () => {
    const r = validateTables("table", 31, 68, { ...full, reading: tbl([[0, 31], [1, 90]]) });
    expect(r.errors.join(" ")).toMatch(/outside 31-68/);
  });
  it("lubang raw hanya peringatan", () => {
    const r = validateTables("table", 31, 68, { ...full, listening: tbl([[0, 31], [3, 33]]) });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/no value for raw 1, 2/);
  });
  it("batas bawah tidak boleh melebihi batas atas", () => expect(validateTables("linear", 68, 31, full).errors[0]).toMatch(/lowest/));
  it("raw negatif atau pecahan ditolak", () => expect(validateTables("table", 31, 68, { ...full, listening: { "-1": 31 } as never }).errors.join(" ")).toMatch(/whole numbers/));
});

describe("previewScore dan toConversion", () => {
  it("tabel dipakai untuk raw yang ada, linear untuk yang tidak ada", () => {
    const conv = { mode: "table" as const, scaledMin: 31, scaledMax: 68, tables: full };
    const r = previewScore(conv as never, [{ section: "listening", raw: 3, total: 50 }, { section: "structure", raw: 1, total: 40 }, { section: "reading", raw: 10, total: 50 }]);
    expect(r.sections[0].scaled).toBe(33); // dari tabel
    expect(r.sections[1].scaled).toBe(33);
    expect(r.sections[2].scaled).toBe(Math.round(31 + (37 * 10) / 50)); // raw 10 tidak ada di tabel: linear
    expect(r.total).toBe(Math.round(((33 + 33 + r.sections[2].scaled) / 3) * 10));
  });
  it("total dibatasi 310-677", () => {
    const conv = { mode: "linear" as const, scaledMin: 31, scaledMax: 68, tables: { listening: {}, structure: {}, reading: {} } };
    expect(previewScore(conv as never, [{ section: "listening", raw: 0, total: 50 }]).total).toBe(310);
    expect(previewScore(conv as never, [{ section: "listening", raw: 50, total: 50 }]).total).toBe(677);
  });
  it("toConversion mengubah Map Mongoose menjadi objek biasa", () => {
    const conv = toConversion({ mode: "table", scaledMin: 31, scaledMax: 68, tables: { listening: new Map([["0", 31]]), structure: new Map(), reading: new Map([["1", 40]]) } } as never);
    expect(conv.tables.listening).toEqual({ "0": 31 });
    expect(conv.tables.reading).toEqual({ "1": 40 });
  });
});
