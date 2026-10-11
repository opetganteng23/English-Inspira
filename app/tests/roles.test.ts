import { describe, it, expect } from "vitest";
import { roleHome, isCentralStaff } from "@/lib/role-home";

describe("peran staf pusat", () => {
  it("halaman awal tiap peran", () => {
    expect(roleHome("admin")).toBe("/admin");
    expect(roleHome("academic_admin")).toBe("/admin");
    expect(roleHome("content_editor")).toBe("/admin/question-bank");
    expect(roleHome("inst_admin")).toBe("/institution");
    expect(roleHome("coach")).toBe("/coach");
    expect(roleHome("participant")).toBe("/home");
  });
  it("hanya tiga peran pusat yang bebas dari enrollment", () => {
    expect(["admin", "academic_admin", "content_editor"].every(isCentralStaff)).toBe(true);
    expect(["participant", "coach", "inst_admin"].some(isCentralStaff)).toBe(false);
  });
});
