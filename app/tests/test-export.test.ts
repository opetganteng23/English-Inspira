import { describe, it, expect } from "vitest";
import { rowStatus } from "@/lib/test-export";

const d = (s: string) => new Date(s);
const win = { opensAt: d("2026-10-20T00:00:00+07:00"), closesAt: d("2026-10-20T23:59:59+07:00") };
describe("status peserta di ekspor hasil", () => {
  it("selesai dan sedang mengerjakan mengikuti percobaan", () => {
    expect(rowStatus({ status: "submitted" }, win)).toBe("Finished");
    expect(rowStatus({ status: "in_progress" }, win)).toBe("In progress");
  });
  it("tanpa percobaan mengikuti jendela jadwal", () => {
    expect(rowStatus(null, win, d("2026-10-19T12:00:00+07:00"))).toBe("Not started (opens later)");
    expect(rowStatus(null, win, d("2026-10-20T10:00:00+07:00"))).toBe("Not started (open now)");
    expect(rowStatus(null, win, d("2026-10-21T08:00:00+07:00"))).toBe("Missed");
    expect(rowStatus(null, null)).toBe("Not scheduled");
  });
});

import { classLetter } from "@/lib/clustering";
describe("nama kelas otomatis", () => {
  it("A..Z lalu AA", () => { expect(classLetter(0)).toBe("A"); expect(classLetter(25)).toBe("Z"); expect(classLetter(26)).toBe("AA"); });
});

import { pageList } from "@/components/Pager";
describe("nomor halaman", () => {
  it("sedikit halaman: semua", () => expect(pageList(2, 5)).toEqual([1, 2, 3, 4, 5]));
  it("di tengah: 1 … 27 28 29 … 56", () => expect(pageList(28, 56)).toEqual([1, "…", 27, 28, 29, "…", 56]));
  it("di awal dan akhir", () => { expect(pageList(1, 56)).toEqual([1, 2, 3, 4, "…", 56]); expect(pageList(56, 56)).toEqual([1, "…", 53, 54, 55, 56]); });
});

import { attendanceOf } from "@/lib/test-export";
describe("kehadiran", () => {
  it("dari status", () => { expect(attendanceOf("Finished")).toBe("Present"); expect(attendanceOf("In progress")).toBe("Present"); expect(attendanceOf("Missed")).toBe("Absent"); expect(attendanceOf("Not started (opens later)")).toBe("Upcoming"); });
});
