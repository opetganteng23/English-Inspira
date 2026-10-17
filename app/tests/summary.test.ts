import { describe, it, expect } from "vitest";
import { buildSummary } from "@/lib/summary";

describe("ringkasan diagnostic", () => {
  const levels = [{ name: "Basic", order: 1, scoreMin: 310, scoreMax: 459 }, { name: "Intermediate", order: 2, scoreMin: 460, scoreMax: 549 }];
  const th = { weak: 60, priority: 40, minItems: 5 };

  it("keandalan, jarak ke level berikutnya, dan prioritas dihitung dari satu percobaan", () => {
    const topics = [
      { skill: "grammar", topic: "verb-form", correct: 1, total: 10, score: 10 }, // bisa diselamatkan: 10 x 0,5 = 5
      { skill: "reading", topic: "inference", correct: 2, total: 5, score: 40 }, // 5 x 0,2 = 1
      { skill: "listening", topic: "detail", correct: 9, total: 10, score: 90 }, // kuat
      { skill: "listening", topic: "idiom", correct: 0, total: 2, score: 0 }, // terlalu sedikit soal
      { skill: "listening", topic: "part-b", correct: 0, total: 20, score: 0 }, // bagian, bukan jenis soal
    ];
    const review = Array.from({ length: 20 }, (_, i) => ({ answered: i < 5, timeSpentSec: i < 5 ? 10 : 0 }));
    const s = buildSummary({ scoreEst: 337, sections: [{ section: "listening", scaled: 35 }, { section: "structure", scaled: 34 }, { section: "reading", scaled: 32 }], review, topics, levels, th, durationSec: 120, allottedSec: 6900, hasPrevious: true });
    expect(s.reliability.level).toBe("low");
    expect(s.reliability.detail).toMatch(/not reliable evidence/);
    expect(s.answered).toEqual({ done: 5, total: 20, pct: 25 });
    expect(s.level.next).toEqual({ name: "Intermediate", scoreMin: 460, avgNeeded: 46 });
    expect(s.gap.map((g) => g.gap)).toEqual([11, 12, 14]);
    expect(s.priorities.map((p) => [p.topic, p.recoverable])).toEqual([["verb-form", 5], ["inference", 1]]);
    expect(s.zones).toEqual({ priority: 1, developing: 1, strong: 1, few: 1 });
    expect(s.plan.map((x) => x.when)).toEqual(["Next attempt", "Weeks 1-2", "Weeks 3-4"]);
  });

  it("jawaban hampir penuh dan waktu wajar: keandalan tinggi tanpa peringatan kemajuan", () => {
    const ok = buildSummary({ scoreEst: 520, sections: [], review: Array.from({ length: 10 }, () => ({ answered: true })), topics: [], levels, th, durationSec: 6000, allottedSec: 6900, hasPrevious: true });
    expect(ok.reliability.level).toBe("high");
    expect(ok.reliability.detail).not.toMatch(/not reliable/);
    expect(ok.level.next).toBeNull(); // 520 sudah level tertinggi dalam contoh ini
    expect(ok.plan[0].action).toMatch(/Keep your pacing/);
  });
});
