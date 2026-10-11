import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodMessage } from "@/lib/zod-message";

const run = (schema: z.ZodType, v: unknown) => { const r = schema.safeParse(v); if (r.success) throw new Error("expected failure"); return zodMessage(r.error); };

describe("zodMessage", () => {
  it("menyebut kolom untuk string kosong", () => {
    expect(run(z.object({ stem: z.string().min(1) }), { stem: "" })).toBe("Question text cannot be empty");
  });
  it("menyebut urutan butir untuk array", () => {
    expect(run(z.object({ options: z.array(z.string().min(1)) }), { options: ["a", ""] })).toBe("Answer options (item 2) cannot be empty");
  });
  it("mempertahankan pesan kustom yang sudah ramah", () => {
    expect(run(z.object({ givenName: z.string().min(1, "Enter your given name") }), { givenName: "" })).toBe("Enter your given name");
  });
  it("tipe salah dijelaskan", () => {
    expect(run(z.object({ title: z.string() }), { title: 5 })).toBe("Title is required or has the wrong type");
  });
  it("terlalu panjang", () => {
    expect(run(z.object({ name: z.string().max(3) }), { name: "abcdef" })).toContain("Name is too long");
  });
});
