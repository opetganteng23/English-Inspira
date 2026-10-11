import { describe, it, expect } from "vitest";
import { unitDrip, hasCycle } from "@/lib/course-access";

describe("unitDrip", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  it("tanpa jeda selalu terbuka", () => expect(unitDrip(0, null).locked).toBe(false));
  it("ada jeda tapi course belum dimulai: terkunci tanpa tanggal", () => expect(unitDrip(7, null)).toEqual({ locked: true, opensAt: null }));
  it("sebelum hari ke-N terkunci, sesudahnya terbuka", () => {
    expect(unitDrip(7, start, new Date("2026-10-07T23:59:00Z")).locked).toBe(true);
    expect(unitDrip(7, start, new Date("2026-10-08T00:00:00Z")).locked).toBe(false);
    expect(unitDrip(7, start).opensAt?.toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });
});

describe("hasCycle", () => {
  const edges = new Map([["b", ["a"]], ["c", ["b"]]]);
  it("prasyarat tanpa siklus lolos", () => expect(hasCycle("d", ["c"], edges)).toBe(false));
  it("prasyarat langsung ke diri sendiri ditolak", () => expect(hasCycle("a", ["a"], edges)).toBe(true));
  it("siklus tidak langsung ditolak", () => expect(hasCycle("a", ["c"], edges)).toBe(true));
});
