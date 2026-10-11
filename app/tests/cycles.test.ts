import { describe, it, expect } from "vitest";
import { cycleStatus, overlaps, placementNeeded } from "@/lib/cycles";

const d = (s: string) => new Date(s);
const c = { startsAt: d("2026-01-01T00:00:00Z"), endsAt: d("2026-06-30T23:59:59Z") };

describe("cycleStatus", () => {
  it("scheduled, active, closed menurut tanggal", () => {
    expect(cycleStatus(c, d("2025-12-31T00:00:00Z"))).toBe("scheduled");
    expect(cycleStatus(c, d("2026-03-01T00:00:00Z"))).toBe("active");
    expect(cycleStatus(c, d("2026-07-01T00:00:00Z"))).toBe("closed");
  });
  it("penutupan manual langsung berlaku", () => expect(cycleStatus({ ...c, closedAt: d("2026-02-01T00:00:00Z") }, d("2026-03-01T00:00:00Z"))).toBe("closed"));
});

describe("overlaps", () => {
  it("periode beririsan ditolak, berurutan boleh", () => {
    expect(overlaps(c, { startsAt: d("2026-06-01T00:00:00Z"), endsAt: d("2026-12-31T00:00:00Z") })).toBe(true);
    expect(overlaps(c, { startsAt: d("2026-07-01T00:00:00Z"), endsAt: d("2026-12-31T00:00:00Z") })).toBe(false);
  });
  it("periode yang ditutup lebih awal membebaskan sisa tanggalnya", () => {
    const closed = { ...c, closedAt: d("2026-03-01T00:00:00Z") };
    expect(overlaps(closed, { startsAt: d("2026-04-01T00:00:00Z"), endsAt: d("2026-12-31T00:00:00Z") })).toBe(false);
  });
});

describe("placementNeeded", () => {
  const id = (n: string) => n as never;
  const none = { hasCycles: false, active: null, blockedReason: null };
  const act = { hasCycles: true, active: { _id: id("c2"), startsAt: c.startsAt, endsAt: c.endsAt }, blockedReason: null };
  it("tanpa periode: hanya bila belum pernah placement", () => {
    expect(placementNeeded({}, none)).toBe(true);
    expect(placementNeeded({ placementAttemptId: id("a") }, none)).toBe(false);
  });
  it("periode baru mewajibkan placement lagi", () => {
    expect(placementNeeded({ placementAttemptId: id("a"), placementCycleId: id("c1") }, act)).toBe(true);
    expect(placementNeeded({ placementAttemptId: id("a"), placementCycleId: id("c2") }, act)).toBe(false);
    expect(placementNeeded({ placementAttemptId: id("a") }, act)).toBe(true);
  });
});
