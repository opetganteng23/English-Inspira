import { describe, it, expect } from "vitest";
import { challengeWithAnswer, verifyCaptcha, createChallenge } from "@/lib/captcha";

describe("captcha bawaan", () => {
  it("jawaban benar diterima (huruf kecil juga), dan hanya sekali", async () => {
    const c = challengeWithAnswer();
    await expect(verifyCaptcha({ token: c.token, answer: c.answer.toLowerCase() })).resolves.toBeUndefined();
    await expect(verifyCaptcha({ token: c.token, answer: c.answer })).rejects.toThrow(/security check/i);
  });
  it("jawaban salah, token rusak, atau kosong ditolak", async () => {
    const c = challengeWithAnswer();
    await expect(verifyCaptcha({ token: c.token, answer: c.answer === "XXXXX" ? "YYYYY" : "XXXXX" })).rejects.toThrow(); // dijamin berbeda dari jawaban asli
    const tampered = c.token.slice(0, -1) + (c.token.endsWith("A") ? "B" : "A"); // dijamin berbeda dari token asli (sebelumnya 1 dari 64 kali tak berubah)
    await expect(verifyCaptcha({ token: tampered, answer: c.answer })).rejects.toThrow();
    await expect(verifyCaptcha(undefined)).rejects.toThrow();
  });
  it("token tidak bisa dipakai untuk jawaban lain", async () => {
    const a = challengeWithAnswer(), b = challengeWithAnswer();
    if (a.answer !== b.answer) await expect(verifyCaptcha({ token: a.token, answer: b.answer })).rejects.toThrow();
  });
  it("gambar tidak memuat jawaban sebagai teks", () => {
    for (let i = 0; i < 20; i++) {
      const c = challengeWithAnswer();
      expect(c.svg).not.toContain("<text");
      expect(c.svg.toUpperCase()).not.toContain(c.answer);
    }
    expect(Object.keys(createChallenge())).toEqual(["token", "svg"]);
  });
});
